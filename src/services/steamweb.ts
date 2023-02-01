import { ERRORS, getAgentOptions, SteamAccountExistsOnline, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import SteamWeb, { ProfilePrivacy } from "@machiavelli/steam-web";
import { SocksProxyAgent } from "socks-proxy-agent";
import { Proxy } from "../../@types/index.js";
import { ChangeAvatarBody, ChangePrivacyBody, ClearAliasesBody } from "../../@types/controllers/steamweb.js";
import { WebSocket } from "ws";

/**
 * Change steam account nickname
 * @service
 */
export async function changeAvatar(userId: ObjectId, body: ChangeAvatarBody, ws: WebSocket) {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, steamAccount.state.proxy);
  const avatarURL = await steamWeb.changeAvatar(body.avatarDataURL);
  ws.sendMessage("steamweb/changeavatar", { avatarURL: avatarURL });
}

/**
 * Clear aliases
 * @service
 */
export async function clearAliases(userId: ObjectId, body: ClearAliasesBody, ws: WebSocket): Promise<void> {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, steamAccount.state.proxy);
  await steamWeb.clearAliases();
  ws.sendMessage("steamweb/clearaliases", "Aliases cleared.");
}

/**
 * Clear aliases
 * @service
 */
export async function changePrivacy(userId: ObjectId, body: ChangePrivacyBody, ws: WebSocket): Promise<void> {
  const { steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const steamWeb = await loginHandler(steamAccount.auth.authTokens.refreshToken, steamAccount.state.proxy);
  await steamWeb.changePrivacy(body.privacy);
  ws.sendMessage("steamweb/changeprivacy", "Privacy changed.");
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
