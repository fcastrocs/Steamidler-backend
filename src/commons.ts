import crypto from "crypto";
import { SocksProxyAgentOptions } from "socks-proxy-agent";
import SteamCommunity from "steamcommunity-api";
import * as SteamAccountModel from "./models/steam-accounts.js";
import { Proxy, SteamAccount } from "../@types";
import SteamStore from "./models/steam-store.js";
import Steam, { AppInfo } from "steam-client";

import { EventEmitter } from "events";
const eventEmitter = new EventEmitter();
export { eventEmitter };

export class SteamIdlerError extends Error {
  constructor(message: string) {
    super(message);
    super.name = "steamidler";
  }
}

const SteamGuardError: string[] = ["AccountLogonDenied", "AccountLoginDeniedNeedTwoFactor"];
const BadSteamGuardCode: string[] = ["InvalidLoginAuthCode", "TwoFactorCodeMismatch"];
const BadPassword: string[] = ["InvalidPassword"];

export const isSteamGuardError = (error: string) => SteamGuardError.includes(error);
export const isBadSteamGuardCode = (error: string) => BadSteamGuardCode.includes(error);
export const isBadPassword = (error: string) => BadPassword.includes(error);
export const isAuthError = (error: string) =>
  isSteamGuardError(error) || isBadSteamGuardCode(error) || isBadPassword(error);

export const ERRORS = {
  EXISTS: new SteamIdlerError("Exists"),
  ENABLE_STEAM_GUARD: new SteamIdlerError("EnableSteamGuard"),
  LOCKED_ACCOUNT: new SteamIdlerError("LockedAccount"),
  ALREADY_ONLINE: new SteamIdlerError("AlreadyOnline"),
  NOTONLINE: new SteamIdlerError("NotOnline"),
  NOTFOUND: new SteamIdlerError("NotFound"),
  UNEXPECTED: new SteamIdlerError("UnexpectedError"),
  NO_FARMABLE_GAMES: new SteamIdlerError("NoFarmableGames"),
  ALREADY_FARMING: new SteamIdlerError("AlreadyFarming"),
  PROXY_LIMIT_REACHED: new SteamIdlerError("ProxyLimitReached"),
  PROXY_NOT_VALID: new SteamIdlerError("ProxyNotValid"),
  INVALID_UPDATE_FIELDS: new SteamIdlerError("InvalidUpdateFields"),
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

export function encrypt(data: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(process.env.ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(data, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decrypt(data: string): string {
  const dataParts = data.split(":");
  const iv = Buffer.from(dataParts[0], "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(process.env.ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(dataParts[1], "hex", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
}

/**
 * merge two games arrays and return the merged and the difference arrays
 */
export function mergeGamesArrays(games1: AppInfo[], games2: AppInfo[]) {
  const merge = games1;
  const difference = [];

  for (const game of games1) {
    // check against games2 for duplicate
    if (games2.some((game2) => game.gameid === game2.gameid)) {
      continue;
    }

    merge.push(game);
    difference.push(game);
  }

  return { merge, difference };
}
