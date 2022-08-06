import SteamCommunity from "steamcommunity-api";
import * as SteamAccountModel from "../models/steam-accounts.js";
import { getAgentOptions, getSteamCommunity, SteamAccountExistsOnline } from "../commons.js";
/**
 * Login to Steam via web
 * @controller
 */
export async function steamWebLogin(options) {
    const steamWebOptions = {};
    let sAccount;
    let steamClient;
    // account must be online for relogin
    if (options.type === "relogin") {
        const { steam, steamAccount } = await SteamAccountExistsOnline(options.relogin.userId, options.relogin.username);
        sAccount = steamAccount;
        steamClient = steam;
    }
    // set steamWebOptions based on login or relogin
    if (options.type === "login") {
        steamWebOptions.webNonce = options.login.webNonce;
        steamWebOptions.steamid = options.login.steamid;
        steamWebOptions.agentOptions = getAgentOptions(options.login.proxy);
    }
    else {
        steamWebOptions.steamid = sAccount.data.steamId;
        steamWebOptions.webNonce = await steamClient.getWebNonce();
        steamWebOptions.agentOptions = getAgentOptions(sAccount.state.proxy);
    }
    // attempt login
    const steamcommunity = new SteamCommunity(steamWebOptions);
    const cookie = await steamcommunity.login();
    // save cookie
    if (options.type === "relogin") {
        sAccount.auth.cookie = cookie;
        await SteamAccountModel.updateField(options.relogin.userId, options.relogin.username, { auth: sAccount.auth });
    }
    return { steamcommunity, cookie };
}
/**
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId, username, avatarDataURL) {
    const { steamAccount } = await SteamAccountExistsOnline(userId, username);
    const steamcommunity = getSteamCommunity(steamAccount);
    const avatarUrl = await steamcommunity.changeAvatar(avatarDataURL);
    await SteamAccountModel.updateField(userId, username, { "data.avatar": avatarUrl });
}
/**
 * Clear aliases
 * @controller
 */
export async function clearAliases(userId, username) {
    const { steamAccount } = await SteamAccountExistsOnline(userId, username);
    const steamcommunity = getSteamCommunity(steamAccount);
    await steamcommunity.clearAliases();
}
/**
 * Clear aliases
 * @controller
 */
export async function changePrivacy(userId, username, privacy) {
    const { steamAccount } = await SteamAccountExistsOnline(userId, username);
    const steamcommunity = getSteamCommunity(steamAccount);
    await steamcommunity.changePrivacy(privacy);
    await SteamAccountModel.updateField(userId, username, { "state.personaState": privacy });
}
