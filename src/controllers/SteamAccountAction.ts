import SteamCommunity, { PrivacySettings, Proxy } from "steamcommunity-api";
import { SocksProxyAgentOptions } from "socks-proxy-agent";
import * as SteamAccountModel from "../models/steamAccount.js";
import SteamStore from "./SteamStore.js";
import { SteamAccount } from "@types";
import Steam from "steam-client-esm";
const NOTONLINE = "This Steam account is not online.";
const NOTEXIST = "This Steam account does not exist.";

/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId: string, username: string, appids: number[]): Promise<void> {
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
export async function changeNick(userId: string, username: string, nick: string): Promise<void> {
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
/*export async function activatef2pgame(userId: string, username: string, nick: string): Promise<Game> {
  const res = await accountExistandOnline(userId, username);

  res.steam.

  // update db
  res.steamAccount.data.nickname = nick;
  await SteamAccountModel.update(res.steamAccount);
}*/

/**
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId: string, username: string, avatar: Express.Multer.File): Promise<void> {
  const { steamAccount } = await accountExistandOnline(userId, username);
  const steamcommunity = new SteamCommunity(
    steamAccount.data.steamId,
    setAgentOptions(steamAccount.state.proxy),
    10000
  );
  steamcommunity.cookie = steamAccount.auth.cookie;

  try {
    const avatarUrl = await steamcommunity.changeAvatar({
      buffer: avatar.buffer,
      type: avatar.mimetype,
    });
    await SteamAccountModel.updateField(userId, username, {
      "data.avatar": avatarUrl,
    });
  } catch (error) {
    console.error(error);
    throw "Action failed, try again";
  }
}

/**
 * Clear aliases
 * @controller
 */
export async function clearAliases(userId: string, username: string): Promise<void> {
  const { steamAccount } = await accountExistandOnline(userId, username);
  const steamcommunity = new SteamCommunity(
    steamAccount.data.steamId,
    setAgentOptions(steamAccount.state.proxy),
    10000
  );
  steamcommunity.cookie = steamAccount.auth.cookie;
  try {
    await steamcommunity.clearAliases();
  } catch (error) {
    console.error(error);
    throw "Action failed, try again";
  }
}

/**
 * Clear aliases
 * @controller
 */
export async function changePrivacy(userId: string, username: string, settings: PrivacySettings): Promise<void> {
  const { steamAccount } = await accountExistandOnline(userId, username);
  const steamcommunity = new SteamCommunity(
    steamAccount.data.steamId,
    setAgentOptions(steamAccount.state.proxy),
    10000
  );
  steamcommunity.cookie = steamAccount.auth.cookie;

  try {
    await steamcommunity.changePrivacy(settings);
  } catch (error) {
    console.error(error);
    throw "Action failed, try again";
  }
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

function setAgentOptions(proxy: Proxy) {
  return <SocksProxyAgentOptions>{
    host: proxy.ip,
    port: proxy.port,
    userId: process.env.PROXY_USER,
    password: process.env.PROXY_PASS,
  };
}
