import SteamCommunity, { PrivacySettings } from "steamcommunity";
import * as SteamAccountModel from "../models/steamAccount";
import SteamStore from "./SteamStore";
import { SteamAccount } from "@types";
import Steam from "ts-steam/src/@types";
const NOTONLINE = "This Steam account is not online.";
const NOTEXIST = "This Steam account does not exist.";

/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId: string, username: string, appids: number[]): Promise<void> {
  const res = await accountExistandOnline(userId, username);
  res.steam.clientGamesPlayed(appids);

  // update db
  res.steamAccount.state.gamesIdling = appids;
  await SteamAccountModel.update(res.steamAccount);
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changeNick(userId: string, username: string, nick: string): Promise<void> {
  const res = await accountExistandOnline(userId, username);

  res.steam.clientChangeStatus({ playerName: nick });

  // update db
  res.steamAccount.data.nickname = nick;
  await SteamAccountModel.update(res.steamAccount);
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId: string, username: string, avatar: Express.Multer.File): Promise<void> {
  const res = await accountExistandOnline(userId, username);
  const steamcommunity = new SteamCommunity(res.steamAccount.data.steamId, res.steamAccount.state.proxy, 10000);
  steamcommunity.cookie = res.steamAccount.auth.cookie;
  const avatarUrl = await steamcommunity.changeAvatar({ buffer: avatar.buffer, type: avatar.mimetype });
  // update db
  res.steamAccount.data.avatar = avatarUrl;
  await SteamAccountModel.update(res.steamAccount);
}

/**
 * Clear aliases
 * @controller
 */
export async function clearAliases(userId: string, username: string): Promise<void> {
  const res = await accountExistandOnline(userId, username);
  const steamcommunity = new SteamCommunity(res.steamAccount.data.steamId, res.steamAccount.state.proxy, 10000);
  steamcommunity.cookie = res.steamAccount.auth.cookie;
  await steamcommunity.clearAliases();
}

/**
 * Clear aliases
 * @controller
 */
export async function changePrivacy(userId: string, username: string, settings: PrivacySettings): Promise<void> {
  const res = await accountExistandOnline(userId, username);
  const steamcommunity = new SteamCommunity(res.steamAccount.data.steamId, res.steamAccount.state.proxy, 10000);
  steamcommunity.cookie = res.steamAccount.auth.cookie;
  await steamcommunity.changePrivacy(settings);
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
    throw NOTEXIST;
  }

  const steam = SteamStore.get(userId, username);
  if (!steam) {
    throw NOTONLINE;
  }
  return { steamAccount, steam };
}
