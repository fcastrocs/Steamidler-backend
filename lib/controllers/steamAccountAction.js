import SteamCommunity from "steamcommunity-api";
import * as SteamAccountModel from "../models/steamAccount.js";
import SteamStore from "./steamStore.js";
import { ERRORS, getAgentOptions } from "../commons.js";
/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId, username, appids) {
    const { steam } = await accountExistandOnline(userId, username);
    steam.clientGamesPlayed(appids);
    await SteamAccountModel.updateField(userId, username, {
        "state.gamesIdling": appids,
    });
}
/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId, username, nick) {
    const { steam } = await accountExistandOnline(userId, username);
    steam.clientChangeStatus({ playerName: nick });
    await SteamAccountModel.updateField(userId, username, {
        "data.nickname": nick,
    });
}
/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId, username, appids) {
    const { steam, steamAccount } = await accountExistandOnline(userId, username);
    const games = await steam.clientRequestFreeLicense(appids);
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
    const { steam, steamAccount } = await accountExistandOnline(userId, username);
    const games = await steam.cdkeyRedeem(cdkey);
    const { difference, joined } = joinGamesArrays(games, steamAccount.data.games);
    steamAccount.data.games = joined;
    await SteamAccountModel.update(steamAccount);
    return difference;
}
/**
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId, username, avatar) {
    const { steamAccount } = await accountExistandOnline(userId, username);
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
    const { steamAccount } = await accountExistandOnline(userId, username);
    const steamcommunity = getSteamCommunity(steamAccount);
    steamcommunity.cookie = steamAccount.auth.cookie;
    await steamcommunity.clearAliases();
}
/**
 * Clear aliases
 * @controller
 */
export async function changePrivacy(userId, username, privacy) {
    const { steamAccount } = await accountExistandOnline(userId, username);
    const steamcommunity = getSteamCommunity(steamAccount);
    steamcommunity.cookie = steamAccount.auth.cookie;
    await steamcommunity.changePrivacy(privacy);
}
function getSteamCommunity(steamAccount) {
    return new SteamCommunity({
        agentOptions: getAgentOptions(steamAccount.state.proxy),
        webNonce: steamAccount.auth.webNonce,
        steamid: steamAccount.data.steamId,
        cookie: steamAccount.auth.cookie,
    });
}
/**
 * Checks if an account exists and it's online
 * @helper
 */
async function accountExistandOnline(userId, username) {
    const steamAccount = await SteamAccountModel.get(userId, username);
    if (!steamAccount) {
        throw ERRORS.NOTFOUND;
    }
    const steam = SteamStore.get(userId, username);
    if (!steam) {
        throw ERRORS.NOTONLINE;
    }
    return { steamAccount, steam };
}
/**
 * Joins two games arrays and returns the joined array and the difference
 */
function joinGamesArrays(games1, games2) {
    const difference = [];
    for (const game of games1) {
        if (games2.some((item) => item.appid === game.appid)) {
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
