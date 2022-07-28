import SteamCommunity, { PrivacySettings } from "steamcommunity-api";
import { SocksProxyAgentOptions } from "socks-proxy-agent";
import Steam, { Game } from "steam-client";
import * as SteamAccountModel from "../models/steamAccount.js";
import SteamStore from "./steamStore.js";

import { Proxy, SteamAccount } from "../../@types";
import { ERRORS } from "../commons.js";

/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId: string, username: string, appids: number[]) {
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
export async function changeNick(userId: string, username: string, nick: string) {
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
export async function activatef2pgame(userId: string, username: string, appids: number[]): Promise<Game[]> {
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
export async function cdkeyRedeem(userId: string, username: string, cdkey: string): Promise<Game[]> {
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
export async function changeAvatar(userId: string, username: string, avatar: Express.Multer.File) {
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
export async function clearAliases(userId: string, username: string): Promise<void> {
  const { steamAccount } = await accountExistandOnline(userId, username);
  const steamcommunity = getSteamCommunity(steamAccount);
  steamcommunity.cookie = steamAccount.auth.cookie;
  await steamcommunity.clearAliases();
}

/**
 * Clear aliases
 * @controller
 */
export async function changePrivacy(userId: string, username: string, settings: PrivacySettings): Promise<void> {
  const { steamAccount } = await accountExistandOnline(userId, username);
  const steamcommunity = getSteamCommunity(steamAccount);
  steamcommunity.cookie = steamAccount.auth.cookie;
  await steamcommunity.changePrivacy(settings);
}

function getSteamCommunity(steamAccount: SteamAccount) {
  return new SteamCommunity({
    agentOptions: setAgentOptions(steamAccount.state.proxy),
    webNonce: steamAccount.auth.webNonce,
    steamid: steamAccount.data.steamId,
    cookie: steamAccount.auth.cookie,
  });
}

/**
 * Checks if an account exists and it's online
 * @helper
 */
async function accountExistandOnline(
  userId: string,
  username: string
): Promise<{ steamAccount: SteamAccount; steam: Steam }> {
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

function setAgentOptions(proxy: Proxy) {
  return <SocksProxyAgentOptions>{
    host: proxy.ip,
    port: proxy.port,
    userId: process.env.PROXY_USER,
    password: process.env.PROXY_PASS,
  };
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
