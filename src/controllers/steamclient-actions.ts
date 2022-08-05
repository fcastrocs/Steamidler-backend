import * as SteamAccountModel from "../models/steam-accounts.js";
import { mergeGamesArrays, SteamAccountExistsOnline } from "../commons.js";
import { AppInfo } from "steam-client";

/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId: string, username: string, gameIds: number[]) {
  const { steam } = await SteamAccountExistsOnline(userId, username);
  steam.idleGames(gameIds);
  await SteamAccountModel.updateField(userId, username, { "state.gamesIdsIdle": gameIds });
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId: string, username: string, nick: string) {
  const { steam } = await SteamAccountExistsOnline(userId, username);
  steam.changePlayerName(nick);
  await SteamAccountModel.updateField(userId, username, { "data.nickname": nick });
}

/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId: string, username: string, appids: number[]): Promise<AppInfo[]> {
  const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
  const games = await steam.activateFreeToPlayGames(appids);
  const { difference, merge } = mergeGamesArrays(games, steamAccount.data.games);
  await SteamAccountModel.updateField(userId, username, { "data.games": merge });
  return difference;
}

/**
 * Activate free to play game.
 * @controller
 */
export async function cdkeyRedeem(userId: string, username: string, cdkey: string): Promise<AppInfo[]> {
  const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
  const games = await steam.cdkeyRedeem(cdkey);
  const { difference, merge } = mergeGamesArrays(games, steamAccount.data.games);
  await SteamAccountModel.updateField(userId, username, { "data.games": merge });
  return difference;
}
