import * as SteamAccountModel from "../models/steam-accounts.js";
import { getSteamCommunity, SteamAccountExistsOnline } from "../commons.js";
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
    await SteamAccountModel.updateField(userId, username, {
        "data.avatar": avatarUrl,
    });
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
}
