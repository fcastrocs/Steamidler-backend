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
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId, username, avatar) {
    const { steamAccount } = await SteamAccountExistsOnline(userId, username);
    const steamcommunity = getSteamCommunity(steamAccount);
    const avatarUrl = await steamcommunity.changeAvatar({
        buffer: avatar.buffer,
        type: avatar.mimetype,
    });
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
