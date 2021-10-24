import { FarmData, Item } from "steamcommunity-api";
import Steam, { AccountAuth, AccountData, PersonaState } from "ts-steam";

declare module "express-session" {
  interface SessionData {
    loggedId: boolean;
    userId: string;
  }
}

// steamAccount Controller
interface Options {
  userId: string;
}

interface ExtendedAccountAuth extends Omit<AccountAuth, "sentry"> {
  password: string;
  cookie: string;
  sentry: Buffer | string;
  type: "email" | "mobile" | "none";
}

interface ExtendedAccountData extends AccountData {
  farmData: FarmData[];
  items: Item[];
}

interface LoginRes {
  auth: AccountAuth;
  data: AccountData;
  steam: Steam;
}

interface ExtendedLoginRes {
  auth: ExtendedAccountAuth;
  data: ExtendedAccountData;
  steam: Steam;
}

// models - steamaccount

interface Encrypted {
  iv: string;
  data: string;
}

interface SteamAccount {
  userId: string;
  username: string;
  auth: ExtendedAccountAuth;
  data: ExtendedAccountData;
  state: {
    error?: "SteamGuardCodeNeeded" | "BadSteamGuardCode" | "InvalidPassword";
    isFarming: boolean;
    status: "online" | "offline" | "reconnecting";
    personaState: PersonaState;
    gamesIdling: number[];
    gamesFarming: number[];
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
  authType: "email" | "mobile";
}

// model proxy
interface Proxy {
  ip: string;
  port: number;
  load: number;
}
