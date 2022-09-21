import * as SteamAccountModel from "../models/steam-accounts.js";
import { ERRORS, isIntArray, SteamAccountExistsOnline, SteamIdlerError } from "../commons.js";
/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId, username, gameIds) {
    isIntArray(gameIds);
    if (gameIds.length > 32) {
        throw new SteamIdlerError(ERRORS.INVALID_BODY);
    }
    const { steam } = await SteamAccountExistsOnline(userId, username);
    steam.client.gamesPlayed(gameIds);
    await SteamAccountModel.updateField(userId, username, { "state.gamesIdsIdle": gameIds });
}
/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId, username, nick) {
    const { steam } = await SteamAccountExistsOnline(userId, username);
    steam.client.setPlayerName(nick);
    await SteamAccountModel.updateField(userId, username, { "data.nickname": nick });
}
/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId, username, appids) {
    isIntArray(appids);
    const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
    const games = await steam.client.requestFreeLicense(appids);
    const { difference, merge } = mergeGamesArrays(steamAccount.data.games, games);
    await SteamAccountModel.updateField(userId, username, { "data.games": merge });
    return difference;
}
/**
 * Activate free to play game.
 * @controller
 */
export async function cdkeyRedeem(userId, username, cdkey) {
    const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
    const games = await steam.client.registerKey(cdkey);
    const { difference, merge } = mergeGamesArrays(steamAccount.data.games, games);
    await SteamAccountModel.updateField(userId, username, { "data.games": merge });
    return difference;
}
/**
 * Activate free to play game.
 * @controller
 */
export async function changePersonaState(userId, username, cdkey) {
    const { steam } = await SteamAccountExistsOnline(userId, username);
    steam.client.setPersonaState("Offline");
}
function mergeGamesArrays(games, games1) {
    throw new Error("Function not implemented.");
}
