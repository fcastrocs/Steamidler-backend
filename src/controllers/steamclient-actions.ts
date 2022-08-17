import * as SteamAccountModel from "../models/steam-accounts.js";
import { ERRORS, isIntArray, mergeGamesArrays, SteamAccountExistsOnline, SteamIdlerError } from "../commons.js";
import { AppInfo } from "steam-client";
import { ObjectId } from "mongodb";

/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId: ObjectId, username: string, gameIds: number[]) {
  isIntArray(gameIds);
  if (gameIds.length > 32) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  const { steam } = await SteamAccountExistsOnline(userId, username);
  steam.idleGames(gameIds);
  await SteamAccountModel.updateField(userId, username, { "state.gamesIdsIdle": gameIds });
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId: ObjectId, username: string, nick: string) {
  const { steam } = await SteamAccountExistsOnline(userId, username);
  steam.changePlayerName(nick);
  await SteamAccountModel.updateField(userId, username, { "data.nickname": nick });
}

/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId: ObjectId, username: string, appids: number[]): Promise<AppInfo[]> {
  isIntArray(appids);
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
export async function cdkeyRedeem(userId: ObjectId, username: string, cdkey: string): Promise<AppInfo[]> {
  const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
  const games = await steam.cdkeyRedeem(cdkey);
  const { difference, merge } = mergeGamesArrays(steamAccount.data.games, games);
  await SteamAccountModel.updateField(userId, username, { "data.games": merge });
  return difference;
}

/**
 * Activate free to play game.
 * @controller
 */
export async function changePersonaState(userId: ObjectId, username: string, cdkey: string): Promise<void> {
  const { steam } = await SteamAccountExistsOnline(userId, username);
  steam.changePersonaState("offline");
}
