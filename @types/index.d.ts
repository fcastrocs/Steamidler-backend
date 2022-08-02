import { FarmableGame, Item, Cookie } from "steamcommunity-api";
import Steam, { AccountAuth, AccountData, PersonaState, IdleGame } from "steam-client";

declare module "express-session" {
  interface SessionData {
    loggedId: boolean;
    userId: string;
    isAdmin: boolean;
  }
}

interface LoginRes {
  auth: AccountAuth;
  data: AccountData;
  steam: Steam;
}

// models - steamaccount

interface Encrypted {
  iv: string;
  data: string;
}

interface ExtendedAccountAuth extends Omit<AccountAuth, "sentry"> {
  password: string;
  cookie: Cookie;
  sentry: Buffer | string;
  type: "email" | "mobile";
}

interface ExtendedAccountData extends AccountData {
  farmableGames: FarmableGame[];
  items: Item[];
}

interface Farming {
  active: boolean;
  games: IdleGame[];
}

interface SteamAccount {
  userId: string;
  username: string;
  auth: ExtendedAccountAuth;
  data: ExtendedAccountData;
  state: {
    authError?: SteamGuardError | BadSteamGuardCode | BadPassword;
    farming: Farming;
    status: "online" | "offline" | "reconnecting";
    personaState: PersonaState;
    gamesIdling: IdleGame[];
    proxy: Proxy;
  };
}

interface SteamAccountEncrypted extends Omit<SteamAccount, "auth"> {
  auth: Encrypted;
}

type SteamAccNonSensitive = Omit<SteamAccount, "userId" | "auth">;

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
  load: number; // number of accounts that are connected to the proxy
}

// model User
interface IUser {
  userId: string;
  nickname: string;
  email: string;
  avatar: string;
  role: "admin" | "user";
}
