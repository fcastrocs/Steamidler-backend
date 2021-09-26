import { Cookie, FarmData, Item } from "steamcommunity";
import { AccountAuth, AccountData } from "ts-steam";

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
  cookie: Cookie;
}

interface ExtendedAccountData extends AccountData {
  farmData: FarmData[];
  items: Item[];
}

interface LoginRes {
  accountAuth: ExtendedAccountAuth;
  accountData: ExtendedAccountData;
  steam: import("ts-steam").default;
}

// models - steamaccount

interface Encrypted {
  iv: string;
  data: string;
}

interface SteamAccount {
  userId: string;
  username: string;
  password: string | Encrypted;
  auth: ExtendedAccountAuth | Encrypted;
  data: ExtendedAccountData;
}

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
