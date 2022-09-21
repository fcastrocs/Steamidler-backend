import * as SteamAccountModel from "../models/steam-accounts.js";
import { ERRORS, getSteamCommunity, SteamAccountExistsOnline, SteamIdlerError } from "../commons.js";
/**
 * Login to Steam via web
 * @controller
 */
export async function steamWebLogin(options) {
    //
}
/**
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId, username, avatarDataURL) {
    if (typeof avatarDataURL !== "string")
        throw new SteamIdlerError(ERRORS.INVALID_BODY);
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
    if (!["public", "friendsOnly", "private"].includes(privacy))
        throw new SteamIdlerError(ERRORS.INVALID_BODY);
    const { steamAccount } = await SteamAccountExistsOnline(userId, username);
    const steamcommunity = getSteamCommunity(steamAccount);
    await steamcommunity.changePrivacy(privacy);
    await SteamAccountModel.updateField(userId, username, { "state.personaState": privacy });
}
