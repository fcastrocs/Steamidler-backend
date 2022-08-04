import * as SteamAccountModel from "../models/steam-accounts.js";
import { SteamAccountExistsOnline } from "../commons.js";
/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId, username, gameIds) {
    const { steam } = await SteamAccountExistsOnline(userId, username);
    steam.idleGames(gameIds);
    await SteamAccountModel.updateField(userId, username, {
        "state.gamesIdling": gameIds,
    });
}
/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId, username, nick) {
    const { steam } = await SteamAccountExistsOnline(userId, username);
    steam.changePlayerName(nick);
    await SteamAccountModel.updateField(userId, username, {
        "data.nickname": nick,
    });
}
/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId, username, appids) {
    const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
    const games = await steam.activateFreeToPlayGames(appids);
    const { difference, joined } = joinGamesArrays(games, steamAccount.data.games);
    steamAccount.data.games = joined;
    await SteamAccountModel.update(steamAccount);
    return difference;
}
/**
 * Activate free to play game.
 * @controller
 */
export async function cdkeyRedeem(userId, username, cdkey) {
    const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
    const games = await steam.cdkeyRedeem(cdkey);
    const { difference, joined } = joinGamesArrays(games, steamAccount.data.games);
    steamAccount.data.games = joined;
    await SteamAccountModel.update(steamAccount);
    return difference;
}
/**
 * Joins two games arrays and returns the joined array and the difference
 */
function joinGamesArrays(games1, games2) {
    const difference = [];
    for (const game of games1) {
        if (games2.some((item) => item.gameid === game.gameid)) {
            continue;
        }
        games2.push(game);
        difference.push(game);
    }
    return {
        joined: games2,
        difference,
    };
}
