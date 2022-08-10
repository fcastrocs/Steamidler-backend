import { ObjectId } from "mongodb";
import { AccountAuth, AccountData, State } from "steam-client";
import { FarmableGame, Item, Cookie } from "steamcommunity-api";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SESSION_SECRET: string;
      ENCRYPTION_KEY: string;
      NODE_ENV: "production" | "development";
      PROXY_USER: string;
      PROXY_PASS: string;
      PROXY_TYPE: string;
      PROXY_TIMEOUT: string;
      PROXY_LOAD_LIMIT: string;
      DB_URI: string;
      POOL_SIZE: string;
      STEAM_RECONNECTS_RETRIES: string;
      STEAM_DOWN_RETRIES: string;
      STEAM_DOWN_INTERVAL: string;
      FARMING_INTERVAL_MINUTES: string;
      STEAM_USERNAME: string;
      STEAM_PASSWORD: string;
      STEAM_CODE: string;
      STEAM_WEBAPI: string;
      API_ADMIN_KEY: string;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId: string;
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

interface AccountState {
  error?: "string";
  farming: boolean;
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
  _id: ObjectId;
  email: string;
  password: string;
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
