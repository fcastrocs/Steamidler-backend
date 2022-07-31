import SteamCommunity, { ProfilePrivacy } from "steamcommunity-api";
import { Game } from "steam-client";
import * as SteamAccountModel from "../models/steamAccount.js";

import { SteamAccount } from "../../@types";
import { getAgentOptions, SteamAccountExistsOnline } from "../commons.js";

/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId: string, username: string, appids: number[]) {
  const { steam } = await SteamAccountExistsOnline(userId, username);
  steam.clientGamesPlayed(appids);
  await SteamAccountModel.updateField(userId, username, {
    "state.gamesIdling": appids,
  });
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId: string, username: string, nick: string) {
  const { steam } = await SteamAccountExistsOnline(userId, username);
  steam.clientChangeStatus({ playerName: nick });
  await SteamAccountModel.updateField(userId, username, {
    "data.nickname": nick,
  });
}

/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId: string, username: string, appids: number[]): Promise<Game[]> {
  const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
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
export async function cdkeyRedeem(userId: string, username: string, cdkey: string): Promise<Game[]> {
  const { steam, steamAccount } = await SteamAccountExistsOnline(userId, username);
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
export async function changeAvatar(userId: string, username: string, avatar: Express.Multer.File) {
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
export async function clearAliases(userId: string, username: string): Promise<void> {
  const { steamAccount } = await SteamAccountExistsOnline(userId, username);
  const steamcommunity = getSteamCommunity(steamAccount);
  steamcommunity.cookie = steamAccount.auth.cookie;
  await steamcommunity.clearAliases();
}

/**
 * Clear aliases
 * @controller
 */
export async function changePrivacy(userId: string, username: string, privacy: ProfilePrivacy): Promise<void> {
  const { steamAccount } = await SteamAccountExistsOnline(userId, username);
  const steamcommunity = getSteamCommunity(steamAccount);
  steamcommunity.cookie = steamAccount.auth.cookie;
  await steamcommunity.changePrivacy(privacy);
}

function getSteamCommunity(steamAccount: SteamAccount) {
  return new SteamCommunity({
    agentOptions: getAgentOptions(steamAccount.state.proxy),
    webNonce: steamAccount.auth.webNonce,
    steamid: steamAccount.data.steamId,
    cookie: steamAccount.auth.cookie,
  });
}

/**
 * Joins two games arrays and returns the joined array and the difference
 */
function joinGamesArrays(games1: Game[], games2: Game[]) {
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
