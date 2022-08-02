import { SocksProxyAgentOptions } from "socks-proxy-agent";
import SteamCommunity from "steamcommunity-api";
import * as SteamAccountModel from "./models/steamAccount.js";
import { Proxy, SteamAccount } from "../@types";
import SteamStore from "./controllers/steamStore.js";
import Steam from "steam-client";

export const ERRORS = {
  EXISTS: "Exists",
  ENABLE_STEAM_GUARD: "EnableSteamGuard",
  LOCKED_ACCOUNT: "LockedAccount",
  ALREADY_ONLINE: "AlreadyOnline",
  NOTONLINE: "NotOnline",
  NOTFOUND: "NotFound",
  UNEXPECTED: "UnexpectedError",
  NO_FARMABLE_GAMES: "NoFarmableGames",
  ALREADY_FARMING: "AlreadyFarming",
} as const;

export function getAgentOptions(proxy: Proxy) {
  return <SocksProxyAgentOptions>{
    hostname: proxy.ip,
    port: proxy.port,
    type: Number(process.env.PROXY_TYPE),
    userId: process.env.PROXY_USER,
    password: process.env.PROXY_PASS,
  };
}

/**
 * Normalizes error so that only string errors are thrown
 */
export function normalizeError(error: string | Error): string {
  if (typeof error !== "string") {
    console.error(error);
    return ERRORS.UNEXPECTED;
  }
  return error;
}

export async function SteamAccountExistsOnline(
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

export function getSteamCommunity(steamAccount: SteamAccount) {
  return new SteamCommunity({
    agentOptions: getAgentOptions(steamAccount.state.proxy),
    webNonce: steamAccount.auth.webNonce,
    steamid: steamAccount.data.steamId,
    cookie: steamAccount.auth.cookie,
  });
}
