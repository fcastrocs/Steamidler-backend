import * as SteamAccountModel from "../models/steam-accounts.js";
import { mergeGamesArrays, SteamAccountExistsOnline } from "../commons.js";
/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId, username, gameIds) {
    const { steam } = await SteamAccountExistsOnline(userId, username);
    steam.idleGames(gameIds);
    await SteamAccountModel.updateField(userId, username, { "state.gamesIdsIdle": gameIds });
}
/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId, username, nick) {
    const { steam } = await SteamAccountExistsOnline(userId, username);
    steam.changePlayerName(nick);
    await SteamAccountModel.updateField(userId, username, { "data.nickname": nick });
}
/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId, username, appids) {
    const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
    const games = await steam.activateFreeToPlayGames(appids);
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
    const games = await steam.cdkeyRedeem(cdkey);
    const { difference, merge } = mergeGamesArrays(steamAccount.data.games, games);
    await SteamAccountModel.updateField(userId, username, { "data.games": merge });
    return difference;
}
