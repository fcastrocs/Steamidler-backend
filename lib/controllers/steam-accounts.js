import Steam, { SteamClientError } from "steam-client";
import SteamCommunity from "steamcommunity-api";
import retry from "@machiavelli/retry";
import SteamStore from "./steam-store.js";
import * as SteamAccountModel from "../models/steam-accounts.js";
import * as ProxyModel from "../models/proxies.js";
import * as SteamcmModel from "../models/steam-servers.js";
import * as SteamVerifyModel from "../models/steam-verifications.js";
import { ERRORS, getAgentOptions, isAuthError, isSteamGuardError, SteamAccountExistsOnline } from "../commons.js";
import { startFarmer, stopFarmer } from "./farmer.js";
/**
 * Add new account
 * @controller
 */
export async function add(userId, username, password, code) {
    if (await SteamAccountModel.get(userId, username)) {
        throw ERRORS.EXISTS;
    }
    // set login options
    const loginOptions = {
        accountName: username,
        password: password,
    };
    // check if account is waiting for steam guard code
    const steamVerify = await SteamVerifyModel.get(userId, username);
    if (steamVerify) {
        // steam guard code was not provided
        if (!code) {
            throw steamVerify.authType;
        }
        // set code to loginOptions
        if (steamVerify.authType === "AccountLogonDenied") {
            loginOptions.authCode = code;
        }
        else {
            loginOptions.twoFactorCode = code;
        }
    }
    // use previous proxy if account was waiting for steam guard code
    const proxy = steamVerify ? steamVerify.proxy : await ProxyModel.getOneProxy();
    let steamCMLoginRes;
    try {
        // attempt CM login
        steamCMLoginRes = await steamcmLogin(loginOptions, proxy);
    }
    catch (error) {
        if (error instanceof SteamClientError) {
            // Steam is asking for guard code
            if (isSteamGuardError(error.message)) {
                // save this config to reuse when user enters the code
                await SteamVerifyModel.add({
                    userId,
                    username: loginOptions.accountName,
                    proxy,
                    authType: error.message,
                    createdAt: new Date(),
                });
            }
        }
        throw error;
    }
    // account does not have steam guard enabled
    if (!steamCMLoginRes.data.secure) {
        throw ERRORS.ENABLE_STEAM_GUARD;
    }
    // account is locked
    if (steamCMLoginRes.data.communityBanned || steamCMLoginRes.data.locked) {
        throw ERRORS.LOCKED_ACCOUNT;
    }
    // login to steamcommunity
    const { cookie, steamcommunity } = await steamWebLogin({
        type: "login",
        login: { steamid: steamCMLoginRes.data.steamId, webNonce: steamCMLoginRes.auth.webNonce, proxy },
    });
    // Create account model
    const steamAccount = {
        userId,
        username,
        auth: {
            ...steamCMLoginRes.auth,
            cookie,
            password,
            type: steamVerify.authType === "AccountLogonDenied" ? "email" : "mobile",
        },
        data: {
            ...steamCMLoginRes.data,
            farmableGames: await steamcommunity.getFarmableGames(),
            items: await steamcommunity.getCardsInventory(),
        },
        state: {
            status: "online",
            personaState: "online",
            farming: { active: false, gameIds: [] },
            gamesIdsIdle: [],
            proxy: proxy,
        },
    };
    // remove steam-verify
    await SteamVerifyModel.remove(userId, username);
    // add to store
    SteamStore.add(userId, username, steamCMLoginRes.steam);
    await SteamAccountModel.add(steamAccount);
    await ProxyModel.increaseLoad(proxy);
    SteamEventListeners(userId, username, steamCMLoginRes.steam);
}
/**
 * login a Steam account
 * @controller
 */
export async function login(userId, username, code, password) {
    if (SteamStore.has(userId, username)) {
        throw ERRORS.ALREADY_ONLINE;
    }
    const steamAccount = await SteamAccountModel.get(userId, username);
    if (!steamAccount) {
        throw ERRORS.NOTFOUND;
    }
    // set login options
    const loginOptions = {
        accountName: username,
        password: password ? password : steamAccount.auth.password,
        machineName: steamAccount.auth.machineName,
        loginKey: steamAccount.auth.loginKey,
        shaSentryfile: steamAccount.auth.sentry,
    };
    // don't use loginkey after auth error
    if (isAuthError(steamAccount.state.authError)) {
        delete loginOptions.loginKey;
        delete loginOptions.shaSentryfile;
    }
    // code passed
    if (code) {
        if (steamAccount.auth.type === "email") {
            loginOptions.authCode = code;
        }
        else {
            loginOptions.twoFactorCode = code;
        }
    }
    let steamCMLoginRes;
    try {
        // attempt CM login
        steamCMLoginRes = await steamcmLogin(loginOptions, steamAccount.state.proxy);
    }
    catch (error) {
        // authentication errors, update account state error
        if (isAuthError(error)) {
            await SteamAccountModel.updateField(userId, username, {
                state: { authError: error.message },
            });
        }
        throw error;
    }
    // update steam account before proceeding because loginKey and sentry could change
    steamAccount.auth.loginKey = steamCMLoginRes.auth.loginKey;
    steamAccount.auth.sentry = steamCMLoginRes.auth.sentry;
    await SteamAccountModel.update(steamAccount);
    // login to steamcommunity
    const { cookie, steamcommunity } = await steamWebLogin({
        type: "login",
        login: {
            steamid: steamCMLoginRes.data.steamId,
            webNonce: steamCMLoginRes.auth.webNonce,
            proxy: steamAccount.state.proxy,
        },
    });
    // update steam account
    steamAccount.auth = {
        ...steamCMLoginRes.auth,
        cookie,
        type: steamAccount.auth.type,
        password: password ? password : steamAccount.auth.password,
    };
    steamAccount.data = {
        ...steamCMLoginRes.data,
        farmableGames: await steamcommunity.getFarmableGames(),
        items: await steamcommunity.getCardsInventory(),
    };
    // save to store
    SteamStore.add(userId, username, steamCMLoginRes.steam);
    steamAccount.state.status = "online";
    delete steamAccount.state.authError;
    await SteamAccountModel.update(steamAccount);
    await restoreAccountState(steamCMLoginRes.steam, steamAccount, userId, username);
    SteamEventListeners(userId, username, steamCMLoginRes.steam);
}
/**
 * Logout a Steam account
 * @controller
 */
export async function logout(userId, username) {
    const steamAccount = await SteamAccountModel.get(userId, username);
    if (!steamAccount) {
        throw ERRORS.NOTFOUND;
    }
    // account is online
    const steam = SteamStore.get(userId, username);
    if (steam) {
        await stopFarmer(userId, username);
        steam.disconnect();
        SteamStore.remove(userId, username);
    }
    //change necessary steamaccount states
    steamAccount.state.status = "offline";
    await SteamAccountModel.update(steamAccount);
}
/**
 * Remove a Steam account
 * @controller
 */
export async function remove(userId, username) {
    await logout(userId, username);
    const steamAccount = await SteamAccountModel.remove(userId, username);
    await ProxyModel.decreaseLoad(steamAccount.state.proxy);
}
/**
 * Login to Steam via web
 * @controller
 */
export async function steamWebLogin(options) {
    const steamWebOptions = {};
    let sAccount;
    // set steamWebOptions based on login or relogin
    if (options.type === "login") {
        steamWebOptions.webNonce = options.login.webNonce;
        steamWebOptions.steamid = options.login.steamid;
        steamWebOptions.agentOptions = getAgentOptions(options.login.proxy);
    }
    else {
        const { steam, steamAccount } = await SteamAccountExistsOnline(options.relogin.userId, options.relogin.username);
        sAccount = steamAccount;
        steamWebOptions.steamid = steamAccount.data.steamId;
        steamWebOptions.webNonce = await steam.getWebNonce();
        steamWebOptions.agentOptions = getAgentOptions(steamAccount.state.proxy);
    }
    const steamcommunity = new SteamCommunity(steamWebOptions);
    const cookie = await steamcommunity.login();
    // save cookie
    if (options.type === "relogin") {
        sAccount.auth.cookie = cookie;
        await SteamAccountModel.update(sAccount);
    }
    return { steamcommunity, cookie };
}
/**
 * Login to steam via CM
 */
async function steamcmLogin(loginOptions, proxy) {
    const steamcm = await SteamcmModel.getOne();
    const options = {
        proxy: {
            host: proxy.ip,
            port: proxy.port,
            type: Number(process.env.PROXY_TYPE),
            userId: process.env.PROXY_USER,
            password: process.env.PROXY_PASS,
        },
        steamCM: {
            host: steamcm.ip,
            port: steamcm.port,
        },
        timeout: Number(process.env.PROXY_TIMEOUT),
    };
    const steam = new Steam(options);
    await steam.connect();
    const res = await steam.login(loginOptions);
    return {
        steam,
        ...res,
    };
}
/**
 * Restore account state:  personastate, farming, and idling after login
 */
async function restoreAccountState(steam, steamAccount, userId, username) {
    steam.changePersonaState(steamAccount.state.personaState);
    if (steamAccount.state.farming.active) {
        await startFarmer(userId, username);
        return;
    }
    // restore idling
    if (steamAccount.state.gamesIdsIdle.length) {
        steam.idleGames(steamAccount.state.gamesIdsIdle);
    }
}
/**
 * Handle account disconnects
 */
function SteamEventListeners(userId, username, steam) {
    steam.on("loginKey", () => console.log(`loginKey: ${username}`));
    steam.on("disconnected", async () => {
        console.log(`DISCONNECTED: ${username}`);
        // remove from online accounts
        SteamStore.remove(userId, username);
        // stop farmer
        await stopFarmer(userId, username);
        // set state.status to 'reconnecting'
        await SteamAccountModel.updateField(userId, username, {
            state: { status: "reconnecting" },
        });
        // generate a number between 1 and 20
        // this is done so that when steam goes offline, the backend doesn't overload.
        const seconds = Math.floor(Math.random() * (20 - 5 + 1) + 5);
        const retries = Number(process.env.STEAM_RECONNECTS_RETRIES);
        const operation = new retry({ retries, interval: seconds * 1000 });
        let steamIsDown = false;
        // attempt login
        operation.attempt(async (currentAttempt) => {
            console.log(`Attempting reconnect #${currentAttempt} of ${retries}: ${username}`);
            try {
                await login(userId, username);
            }
            catch (error) {
                console.log(`Reconnect attempt #${currentAttempt} of ${retries} failed: ${username} - error: ${error}`);
                // got auth error after first try, stop retrying.
                if (currentAttempt > 1) {
                    if (isAuthError(error)) {
                        return;
                    }
                }
                // Steam is down increase interval to 10 minutes
                if (error === "ServiceUnavailable") {
                    if (!steamIsDown) {
                        steamIsDown = true;
                        console.log(`STEAM IS DOWN, increasing retry interval to 10 minutes: ${username}`);
                        operation.setNewConfig({
                            retries: Number(process.env.STEAM_DOWN_RETRIES),
                            interval: Number(process.env.STEAM_DOWN_INTERVAL),
                        });
                    }
                }
                // retry operation
                if (operation.retry()) {
                    return;
                }
                // reconnect failed, set status to offline
                await SteamAccountModel.updateField(userId, username, {
                    state: { status: "offline" },
                });
            }
        });
    });
}
