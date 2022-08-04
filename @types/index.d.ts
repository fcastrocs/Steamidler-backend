import { AccountAuth, AccountData, State } from "steam-client";
import { FarmableGame, Item, Cookie } from "steamcommunity-api";

declare module "express-session" {
  interface SessionData {
    loggedId: boolean;
    userId: string;
    isAdmin: boolean;
  }
}

declare module "steam-client" {
  interface AccountAuth {
    password: string;
    cookie: Cookie;
    type: "email" | "mobile";
  }

  interface AccountData {
    farmableGames: FarmableGame[];
    items: Item[];
  }
}

interface Farming {
  active: boolean;
  gameIds: number[];
}

interface AccountState {
  authError?: SteamGuardError | BadSteamGuardCode | BadPassword;
  farming: Farming;
  status: "online" | "offline" | "reconnecting";
  personaState: State;
  gamesIdsIdle: number[];
  proxy: Proxy;
}

interface SteamAccount {
  userId: string;
  username: string;
  auth: AccountAuth;
  data: AccountData;
  state: AccountState;
}

interface LoginRes {
  auth: AccountAuth;
  data: AccountData;
  steam: Steam;
}

/**
 * SteamAccount Object stored in database
 */
interface SteamAccountEncrypted extends Omit<SteamAccount, "auth"> {
  auth: string;
}

/**
 * SteamAccount Object sent to requests
 */
type SteamAccountNonSensitive = Omit<SteamAccount, "userId" | "auth">;

// model - steamcm
interface SteamCM {
  ip: string;
  port: number;
}

// model - steam-verify
interface SteamVerify {
  userId: string;
  username: string;
  proxy: Proxy;
  authType: SteamGuardError;
  createdAt: Date;
}

// model proxy
interface Proxy {
  ip: string;
  port: number;
}

// model User
interface User {
  userId: string;
  nickname: string;
  email: string;
  avatar: string;
  role: "admin" | "user";
  createdAt: Date;
  ip: string;
}

interface Invite {
  email: string;
  code: string;
  createdAt: Date;
}

interface GetCMListResponse {
  response: { serverlist: string[]; serverlist_websockets: string[]; result: number; message: string };
}
