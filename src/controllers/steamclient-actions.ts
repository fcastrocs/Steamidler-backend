import * as SteamAccountModel from "../models/steam-accounts.js";
import { SteamAccountExistsOnline } from "../commons.js";
import { AppInfo } from "steam-client";
import { SteamAccount } from "../../@types";

/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId: string, username: string, gameIds: number[]) {
  const { steam } = await SteamAccountExistsOnline(userId, username);
  steam.idleGames(gameIds);
  await SteamAccountModel.updateField(userId, username, { state: { gamesIdsIdle: gameIds } } as Partial<SteamAccount>);
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId: string, username: string, nick: string) {
  const { steam } = await SteamAccountExistsOnline(userId, username);
  steam.changePlayerName(nick);
  await SteamAccountModel.updateField(userId, username, { data: { nickname: nick } } as Partial<SteamAccount>);
}

/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId: string, username: string, appids: number[]): Promise<AppInfo[]> {
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
export async function cdkeyRedeem(userId: string, username: string, cdkey: string): Promise<AppInfo[]> {
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
function joinGamesArrays(games1: AppInfo[], games2: AppInfo[]) {
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
