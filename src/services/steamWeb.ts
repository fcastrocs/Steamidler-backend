import * as SteamAccountModel from "../models/steamAccount.js";
import SteamWeb, { FarmableGame } from "@machiavelli/steam-web";
import { SocksProxyAgent } from "socks-proxy-agent";
import { getAgentOptions, SteamAccountExistsOnline } from "../commons.js";
import { ObjectId } from "mongodb";
import {
  ChangeAvatarBody,
  ChangePrivacyBody,
  ClearAliasesBody,
  GetAvatarFrameBody,
  GetFarmableGamesBody,
} from "../../@types/controllers/steamWeb.js";
import * as ProxyModel from "../models/proxy.js";
import { wsServer } from "../app.js";

/**
 * Change steam account nickname
 * @service
 */
export async function changeAvatar(userId: ObjectId, body: ChangeAvatarBody) {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const proxy = await ProxyModel.getById(steamAccount.state.proxyId);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, proxy);
  const avatarURL = await steamWeb.changeAvatar(body.avatarDataURL);
  wsServer.send({ userId, routeName: "steamweb/changeavatar", type: "Success", message: avatarURL });
}

/**
 * Clear aliases
 * @service
 */
export async function clearAliases(userId: ObjectId, body: ClearAliasesBody) {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const proxy = await ProxyModel.getById(steamAccount.state.proxyId);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, proxy);
  await steamWeb.clearAliases();
  wsServer.send({ userId, routeName: "steamweb/clearaliases", type: "Success" });
}

/**
 * Clear aliases
 * @service
 */
export async function changePrivacy(userId: ObjectId, body: ChangePrivacyBody) {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const proxy = await ProxyModel.getById(steamAccount.state.proxyId);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, proxy);
  await steamWeb.changePrivacy(body.privacy);
  wsServer.send({ userId, routeName: "steamweb/changeprivacy", type: "Success" });
}

/**
 * Get farmable games
 * @service
 */
export async function getFarmableGames(userId: ObjectId, body: GetFarmableGamesBody): Promise<FarmableGame[]> {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const proxy = await ProxyModel.getById(steamAccount.state.proxyId);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, proxy);
  const farmableGames = await steamWeb.getFarmableGames();

  // update farming state
  await SteamAccountModel.updateField(userId, body.accountName, {
    "data.farmableGames": farmableGames,
  });

  wsServer.send({ userId, routeName: "steamweb/getfarmablegames", type: "Success", message: farmableGames });
  return farmableGames;
}

/**
 * Clear aliases
 * @service
 */
export async function getAvatarFrame(userId: ObjectId, body: GetAvatarFrameBody) {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const proxy = await ProxyModel.getById(steamAccount.state.proxyId);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, proxy);
  const url = await steamWeb.getAvatarFrame();

  // update farming state
  const account = await SteamAccountModel.updateField(userId, body.accountName, {
    "data.avatarFrame": url,
  });

  wsServer.send({ userId, routeName: "steamweb/getavatarframe", type: "Success", message: account });
}

/**
 * Login to Steam via web
 */
export async function steamWebLogin(refreshToken: string, proxy: Proxy) {
  const steamWeb = await loginHandler(refreshToken, proxy);
  const items = await steamWeb.getCardsInventory();
  const farmableGames = await steamWeb.getFarmableGames();
  const avatarFrame = await steamWeb.getAvatarFrame();
  return { items, farmableGames, avatarFrame };
}

/**
 * Login to steam Web
 */
export async function loginHandler(refreshToken: string, proxy: Proxy) {
  const steamWeb = new SteamWeb({ agent: new SocksProxyAgent(getAgentOptions(proxy)) });
  await steamWeb.login(refreshToken);
  return steamWeb;
}
