import Steam, { LoginOptions } from "ts-steam";
import SteamCommunity from "steamcommunity";
import { SocksClientOptions } from "socks";
import * as SteamAccountModel from "../models/steamAccount";
import * as ProxyModel from "../models/proxy";
import * as SteamcmModel from "../models/steamcm";
import * as SteamVerifyModel from "../models/steamVerify";
import * as AutoLogin from "../models/autoLogin";
import SteamStore from "./SteamStore";
// import types
import { AddOptions, LoginRes, SteamAccount, SteamCM, ExtendedAccountAuth, ExtendedAccountData, Proxy } from "@types";

/**
 * Add new account
 * @controller
 */
export async function add(options: AddOptions): Promise<void> {
  const userId = options.userId;
  const username = options.username;
  const password = options.password;

  // check if account is already online.
  if (SteamStore.has(userId, username)) {
    throw "This Steam account is already online.";
  }

  if (await SteamAccountModel.exists(userId, username)) {
    throw "This Steam account already exists.";
  }

  // set login options
  const loginOptions: LoginOptions = {
    accountName: username,
    password: password,
  };

  let proxy = await ProxyModel.getOne();
  const steamcm = await SteamcmModel.getOne();

  // check if account is waiting for steam guard code
  const steamVerify = await SteamVerifyModel.get(userId, username);
  if (steamVerify) {
    // steam guard code was not provided
    if (!options.code) {
      throw "Steam guard code is needed.";
    }

    // reuse proxy, otherwise steam will reject login
    proxy = steamVerify.proxy;

    // set code to loginOptions
    if (steamVerify.authType === "email") {
      loginOptions.authCode = options.code;
    } else {
      loginOptions.twoFactorCode = options.code;
    }
  }

  // attempt CM login
  let loginRes: LoginRes;
  try {
    // login
    loginRes = await steamcmLogin(loginOptions, proxy, steamcm);
    console.log("steamcm logged in");
  } catch (error) {
    // Steam is asking for guard code
    if (isVerificationError(error)) {
      // save this config to reuse when user enters the code
      SteamVerifyModel.add({
        userId,
        username,
        proxy,
        authType: error === "AccountLogonDenied" || error === "AccountLoginDeniedNeedTwoFactor" ? "email" : "mobile",
      });
      throw "GuardCodeNeeded";
    }
    throw error;
  }

  // attempt steamcommunity login
  const webNonce = loginRes.accountAuth.webNonce;
  const steamId = loginRes.accountData.steamId;

  const steamcommunity = new SteamCommunity(steamId, webNonce, proxy, 10000);
  loginRes.accountAuth.cookie = await steamcommunity.login();
  console.log("steamcommunity logged in");

  // get inventory and farm data
  loginRes.accountData.items = await steamcommunity.getCardsInventory();
  loginRes.accountData.farmData = await steamcommunity.getFarmingData();

  const steamAccount: SteamAccount = {
    userId,
    username,
    password,
    auth: loginRes.accountAuth,
    data: loginRes.accountData,
  };

  // save to db
  await SteamAccountModel.add(steamAccount);
  // save to store
  SteamStore.add(userId, username, loginRes.steam);
  // Save autologin
  // todo

  disconnectListener(steamAccount, loginRes.steam);

  //restore states
  // todo
}

/**
 * logs in a steam account
 * @controller
 */
async function login(userId: string, username: string) {
  if (SteamStore.has(userId, username)) {
    throw "This steam account is already online";
  }

  const SteamAccount = await SteamAccountModel.get(userId, username);
  if (!SteamAccount) {
    throw "This Steam account does not exist";
  }
}

/**
 * Logins to steam via cm
 * @helper
 */
async function steamcmLogin(loginOptions: LoginOptions, proxy: Proxy, steamcm: SteamCM): Promise<LoginRes> {
  // setup socks options
  const socksOptions: SocksClientOptions = {
    proxy: {
      host: proxy.ip,
      port: proxy.port,
      type: 5,
    },
    destination: {
      host: steamcm.ip,
      port: steamcm.port,
    },
    command: "connect",
  };

  // connect to steam
  const steam = new Steam();
  // connect can throw 'dead proxy or steamcm' or 'encryption failed'
  await steam.connect(socksOptions, 10000);

  // listen and handle steam events
  // listenToSteamEvents(userId, loginOptions.accountName, steam);

  // attempt cm login
  const res = await steam.login(loginOptions);

  return {
    accountAuth: <ExtendedAccountAuth>res.auth,
    accountData: <ExtendedAccountData>res.data,
    steam,
  };
}

/**
 * Logs out a steam account
 * @controller
 */
async function logout(userId: string, username: string) {
  if (!(await SteamAccountModel.exists(userId, username))) {
    throw "This Steam account doesn't exists.";
  }

  // remove from SteamStore
  const steam = SteamStore.get(userId, username);
  if (steam) {
    steam.destroyConnection(true);
    SteamStore.remove(userId, username);
  }

  //remove from autologin
  await AutoLogin.remove(userId, username);

  //change necessary steamaccount states
  //stop farming
}

/**
 * @listener
 */
function disconnectListener(steamAccount: SteamAccount, steam: Steam) {
  steam.on("disconnected", async () => {
    console.log(`STEAM ACCOUNT DISCONNECTED: ${steamAccount.username}`);

    // stop farming interval if exists
    //stopFarmingInterval(userId, accountName);

    // remove from online accounts
    // SteamMap.remove(userId, accountName);

    // attempt reconnect
    // await attempReconnect(userId, accountName);
  });
}

/**
 * Restore account state: status, idling and farming
 */
async function restoreState(steamAccount: SteamAccount) {
  // restore epersonastate
  //retore farming...
  // restore idling games if any
}

/**
 * @helper
 */
function isVerificationError(error: string): boolean {
  if (
    error === "AccountLogonDenied" || // need email code
    error === "TwoFactorCodeMismatch" || // invalid mobile code ?
    error === "AccountLoginDeniedNeedTwoFactor" || // need mobile code
    error === "InvalidLoginAuthCode" // invalid email code
  ) {
    return true;
  }
  return false;
}
