import { FarmData, Item, Cookie } from "steamcommunity-api";
import Steam, { AccountAuth, AccountData, PersonaState } from "steam-client";

const steamGuardError = ["AccountLogonDenied", "AccountLoginDeniedNeedTwoFactor"] as const;
type SteamGuardError = typeof steamGuardError[number];

const badSteamGuardCode = ["InvalidLoginAuthCode", "TwoFactorCodeMismatch"] as const;
type BadSteamGuardCode = typeof badSteamGuardCode[number];

const badPassword = ["InvalidPassword"] as const;
type BadPassword = typeof badPassword[number];

declare module "express-session" {
  interface SessionData {
    loggedId: boolean;
    userId: string;
    isAdmin: boolean;
  }
}

interface HttpException extends SyntaxError {
  status: number;
  message: string;
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
  type: "email" | "mobile" | "none";
}

interface ExtendedAccountData extends AccountData {
  farmData: FarmData[];
  items: Item[];
}

interface SteamAccount {
  userId: string;
  username: string;
  auth: ExtendedAccountAuth;
  data: ExtendedAccountData;
  state: {
    authError?: SteamGuardError | BadSteamGuardCode | BadPassword;
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
  authType: SteamGuardError;
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
