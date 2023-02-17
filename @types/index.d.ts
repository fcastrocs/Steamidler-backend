import { AuthTokens } from "@machiavelli/steam-client/@types/services/Auth";
import { ObjectId } from "mongodb";
import { AccountAuth, AccountData } from "@machiavelli/steam-client";
import { FarmableGame, Item, Cookie } from "steamcommunity-api";
import { State } from "./addSteamAccount";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ACCESS_SECRET: string;
      REFRESH_SECRET: string;
      ENCRYPTION_KEY: string;
      NODE_ENV: "production" | "development" | "stage";
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
      RECAPTCHA_SECRET: string;
    }
  }
}

declare module "http" {
  interface IncomingMessage {
    body: { userId: ObjectId };
  }
}

declare module "ws" {
  interface WebSocket {
    isAlive: boolean;
    userId: string;
    sendSuccess: (type: string, message?: any) => void;
    sendError: (name: string, message: string) => void;
    sendInfo: (type: string, message: any) => void;
  }
}

interface WebSocketReqBody {
  type: string;
  body: { [key: string]: T };
}

declare module "@machiavelli/steam-client" {
  export interface AccountAuth {
    password?: string;
    cookie: Cookie;
    authTokens: AuthTokens;
  }

  interface AccountData {
    farmableGames: FarmableGame[];
    items: Item[];
  }
}

interface AccountState {
  farming: boolean;
  status: "online" | "offline" | "reconnecting" | "AccessDenied";
  gamesIdsIdle: number[];
  proxy: Proxy;
}

interface SteamAccount {
  userId: ObjectId;
  accountName: string;
  steamId: string;
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
  userId: ObjectId;
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
  username: string;
  email: string;
  password: string;
  createdAt: Date;
  ip: string;
}

interface RefreshToken {
  userId: ObjectId;
  token: string;
}

interface Cookies {
  "refresh-token": string;
  "access-jwt": string;
}

interface Invite {
  email: string;
  code: string;
  createdAt: Date;
}

interface GetCMListResponse {
  response: {
    serverlist: string[];
    serverlist_websockets: string[];
    result: number;
    message: string;
  };
}

interface GoogleRecaptchaResponse {
  success: boolean;
  "error-codes": string[];
}
