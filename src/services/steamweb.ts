import { getAgentOptions, SteamAccountExistsOnline } from "../commons.js";
import * as SteamAccountModel from "../models/steamAccount.js";
import { ObjectId } from "mongodb";
import SteamWeb, { FarmableGame } from "@machiavelli/steam-web";
import { SocksProxyAgent } from "socks-proxy-agent";
import { Proxy } from "../../@types/index.js";
import {
  ChangeAvatarBody,
  ChangePrivacyBody,
  ClearAliasesBody,
  GetFarmableGamesBody,
} from "../../@types/controllers/steamWeb.js";
import { wsServer } from "../app.js";

/**
 * Change steam account nickname
 * @service
 */
export async function changeAvatar(userId: ObjectId, body: ChangeAvatarBody) {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, steamAccount.state.proxy);
  const avatarURL = await steamWeb.changeAvatar(body.avatarDataURL);
  wsServer.send({ userId, routeName: "steamweb/changeavatar", type: "Success", message: avatarURL });
}

/**
 * Clear aliases
 * @service
 */
export async function clearAliases(userId: ObjectId, body: ClearAliasesBody) {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, steamAccount.state.proxy);
  await steamWeb.clearAliases();
  wsServer.send({ userId, routeName: "steamweb/clearaliases", type: "Success" });
}

/**
 * Clear aliases
 * @service
 */
export async function changePrivacy(userId: ObjectId, body: ChangePrivacyBody) {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, steamAccount.state.proxy);
  await steamWeb.changePrivacy(body.privacy);
  wsServer.send({ userId, routeName: "steamweb/changeprivacy", type: "Success" });
}

/**
 * Get farmable games
 * @service
 */
export async function getFarmableGames(userId: ObjectId, body: GetFarmableGamesBody): Promise<FarmableGame[]> {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);

  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, steamAccount.state.proxy);
  const farmableGames = await steamWeb.getFarmableGames();

  // update farming state
  await SteamAccountModel.updateField(userId, body.accountName, {
    "data.farmableGames": farmableGames,
  });

  wsServer.send({ userId, routeName: "steamweb/getfarmablegames", type: "Success", message: farmableGames });
  return farmableGames;
}

/**
 * Login to Steam via web
 */
export async function steamWebLogin(refreshToken: string, proxy: Proxy) {
  const steamWeb = await loginHandler(refreshToken, proxy);
  const items = await steamWeb.getCardsInventory();
  const farmableGames = await steamWeb.getFarmableGames();
  return { items, farmableGames };
}

/**
 * Login to steam Web
 */
export async function loginHandler(refreshToken: string, proxy: Proxy) {
  const steamWeb = new SteamWeb({ agent: new SocksProxyAgent(getAgentOptions(proxy)) });
  await steamWeb.login(refreshToken);
  return steamWeb;
}
