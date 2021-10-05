import { FarmData, Item } from "steamcommunity";
import Steam, { AccountAuth, AccountData } from "ts-steam";

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

interface AddOptions extends Options {
  username: string;
  password: string;
  code?: string;
}

interface ExtendedAccountAuth extends AccountAuth {
  cookie: string;
}

interface ExtendedAccountData extends AccountData {
  farmData: FarmData[];
  items: Item[];
}

interface LoginRes {
  accountAuth: ExtendedAccountAuth;
  accountData: ExtendedAccountData;
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
  password: string;
  auth: ExtendedAccountAuth;
  data: ExtendedAccountData;
  state: {
    error?: string;
    isFarming: boolean;
    status: "online" | "offline";
    personaState: number;
    gamesIdling: number[];
    gamesFarming: number[];
    proxy: Proxy;
  };
}

interface SteamAccountEncrypted extends Omit<SteamAccount, "password" | "auth"> {
  password: Encrypted;
  auth: Encrypted;
}

type SteamAccNonSensitive = Omit<SteamAccount, "userId" | "password" | "auth">;

// model - steamcm

interface SteamCM {
  ip: string;
  port: number;
}

// model - steam-verify
interface SteamVerify {
  userId: string;
  username: string;
  proxy: { ip: string; port: number };
  authType: "email" | "mobile";
}

// model proxy
interface Proxy {
  ip: string;
  port: number;
}
