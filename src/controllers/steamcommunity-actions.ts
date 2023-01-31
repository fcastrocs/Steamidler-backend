import * as SteamAccountModel from "../models/steam-accounts.js";
import { ERRORS, getAgentOptions, getSteamCommunity, SteamAccountExistsOnline, SteamIdlerError } from "../commons.js";
import { Proxy, SteamAccount } from "../../@types/index.js";
import { ObjectId } from "mongodb";
import Steam from "@machiavelli/steam-client";
import SteamWeb, { ProfilePrivacy } from "@machiavelli/steam-web";
import { SocksProxyAgent } from "socks-proxy-agent";

/**
 * Login to Steam via web
 * @controller
 */
export async function steamWebLogin(refreshToken: string) {
  const steamWeb = new SteamWeb();
  const session = await steamWeb.login(refreshToken);
  const items = await steamWeb.getCardsInventory();
  const farmableGames = await steamWeb.getFarmableGames();
  return { items, farmableGames };
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId: ObjectId, username: string, avatarDataURL: string) {
  if (typeof avatarDataURL !== "string") throw new SteamIdlerError(ERRORS.INVALID_BODY);

  const { steamAccount } = await SteamAccountExistsOnline(userId, username);
  const steamcommunity = getSteamCommunity(steamAccount);
  const avatarUrl = await steamcommunity.changeAvatar(avatarDataURL);
  await SteamAccountModel.updateField(userId, username, {
    "data.avatar": avatarUrl,
  });
}

/**
 * Clear aliases
 * @controller
 */
export async function clearAliases(userId: ObjectId, username: string): Promise<void> {
  const { steamAccount } = await SteamAccountExistsOnline(userId, username);
  const steamcommunity = getSteamCommunity(steamAccount);
  await steamcommunity.clearAliases();
}

/**
 * Clear aliases
 * @controller
 */
export async function changePrivacy(userId: ObjectId, username: string, privacy: ProfilePrivacy): Promise<void> {
  if (!["public", "friendsOnly", "private"].includes(privacy)) throw new SteamIdlerError(ERRORS.INVALID_BODY);

  const { steamAccount } = await SteamAccountExistsOnline(userId, username);
  const steamcommunity = getSteamCommunity(steamAccount);
  await steamcommunity.changePrivacy(privacy);
  await SteamAccountModel.updateField(userId, username, {
    "state.personaState": privacy,
  });
}
