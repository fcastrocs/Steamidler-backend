import Steam, { LoginOptions, PersonaState } from "ts-steam";
import SteamCommunity from "steamcommunity-api";
import { SocksClientOptions } from "socks";
import * as SteamAccountModel from "../models/steamAccount";
import * as ProxyModel from "../models/proxy";
import * as SteamcmModel from "../models/steamcm";
import * as SteamVerifyModel from "../models/steamVerify";
import SteamStore from "./SteamStore";
import retry from "@machiavelli/retry";

import {
  LoginRes,
  SteamAccount,
  SteamCM,
  ExtendedAccountAuth,
  ExtendedAccountData,
  Proxy,
  ExtendedLoginRes,
} from "@types";
const ONLINE = "This Steam account is already online.";
const EXIST = "This Steam account already exists.";
const NOTEXIST = "This Steam account does not exist.";
const PERSONASTATE = {
  Offline: 0,
  Online: 1,
  Busy: 2,
  Away: 3,
  Snooze: 4,
};

/**
 * Add new account
 * @controller
 */
export async function add(userId: string, username: string, password: string, code?: string): Promise<void> {
  if (SteamStore.has(userId, username)) {
    throw ONLINE;
  }

  if (await SteamAccountModel.exists(userId, username)) {
    throw EXIST;
  }

  // set login options
  const loginOptions: LoginOptions = {
    accountName: username,
    password: password,
  };

  // check if account is waiting for steam guard code
  const steamVerify = await SteamVerifyModel.get(userId, username);
  if (steamVerify) {
    // steam guard code was not provided
    if (!code) {
      throw "Steam guard code is needed.";
    }

    // set code to loginOptions
    if (steamVerify.authType === "email") {
      loginOptions.authCode = code;
    } else {
      loginOptions.twoFactorCode = code;
    }
  }

  const proxy = steamVerify ? steamVerify.proxy : await ProxyModel.getOne();

  // attempt login
  let loginRes: ExtendedLoginRes;
  try {
    loginRes = await fullyLogin(loginOptions, proxy);
  } catch (error) {
    // Steam is asking for guard code
    if (isVerificationError(error)) {
      // save this config to reuse when user enters the code
      SteamVerifyModel.add({
        userId,
        username: loginOptions.accountName,
        proxy,
        authType: error === "AccountLogonDenied" ? "email" : "mobile",
      });
      throw "GuardCodeNeeded";
    }
    throw error;
  }

  // remove steam-verify
  await SteamVerifyModel.remove(userId, username);
  // add to store
  SteamStore.add(userId, username, loginRes.steam);

  // Create account model
  const steamAccount: SteamAccount = {
    userId,
    username,
    password,
    auth: loginRes.auth,
    data: loginRes.data,
    state: {
      status: "online",
      personaState: PERSONASTATE.Online as PersonaState,
      isFarming: false,
      gamesIdling: [],
      gamesFarming: [],
      proxy: proxy,
    },
  };

  // save to db
  await SteamAccountModel.add(steamAccount);
  // update proxy load
  await ProxyModel.updateLoad(proxy);

  // listen to disconnects
  accountDisconnectListener(userId, username, loginRes.steam);
}

/**
 * logs in a steam account
 * @controller
 */
export async function login(userId: string, username: string): Promise<void> {
  if (SteamStore.has(userId, username)) {
    throw ONLINE;
  }

  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw NOTEXIST;
  }

  // set login options
  const loginOptions: LoginOptions = {
    accountName: username,
    password: steamAccount.password,
    machineName: steamAccount.auth.machineName,
    loginKey: steamAccount.auth.loginKey,
    shaSentryfile: steamAccount.auth.sentry as Buffer,
  };

  // have to use password instead of loginKey after auth error
  if (isAuthError(steamAccount.state.error)) {
    delete loginOptions.loginKey;
  } else {
    delete loginOptions.password;
  }

  const proxy = steamAccount.state.proxy;

  // attempt CM login
  let loginRes: ExtendedLoginRes;
  try {
    loginRes = await fullyLogin(loginOptions, proxy);
  } catch (error) {
    if (isAuthError(error)) {
      // set error
      await SteamAccountModel.updateField(userId, username, { "state.error": error });
    }
    throw error;
  }

  // save to store
  SteamStore.add(userId, username, loginRes.steam);

  // update steam account
  steamAccount.auth = loginRes.auth;
  steamAccount.data = loginRes.data;
  steamAccount.state.status = "online";
  steamAccount.state.proxy = proxy;
  delete steamAccount.state.error;
  await SteamAccountModel.update(steamAccount);

  await restoreAccountState(loginRes.steam, steamAccount);

  // listen to disconnects
  accountDisconnectListener(userId, username, loginRes.steam);
}

/**
 * Logs out a steam account
 * @controller
 */
export async function logout(userId: string, username: string): Promise<void> {
  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw NOTEXIST;
  }

  const steam = SteamStore.get(userId, username);
  if (steam) {
    steam.destroyConnection(true);
    SteamStore.remove(userId, username);
  }

  //change necessary steamaccount states
  steamAccount.state.status = "offline";
  await SteamAccountModel.update(steamAccount);

  //stop farming
  //todo
}

/**
 * Remove a steam account
 * @controller
 */
export async function remove(userId: string, username: string): Promise<void> {
  if (!(await SteamAccountModel.remove(userId, username))) {
    throw NOTEXIST;
  }

  const steam = SteamStore.remove(userId, username);
  if (steam) {
    steam.destroyConnection(true);
    // stop farming
    // todo
  }
}

/**
 * Fully logs in a steam account
 * Logs in to steamcm, steamcommunity, then gets inventory and farmData
 * Creates a SteamVerify if Steam asks for a code
 * @helper
 */
async function fullyLogin(loginOptions: LoginOptions, proxy: Proxy): Promise<ExtendedLoginRes> {
  const steamcm = await SteamcmModel.getOne();
  // attempt CM login
  const loginRes = await steamcmLogin(loginOptions, proxy, steamcm);

  // attempt steamcommunity login
  const webNonce = loginRes.auth.webNonce;
  const steamId = loginRes.data.steamId;

  const steamcommunity = new SteamCommunity(
    steamId,
    { host: proxy.ip, port: proxy.port, type: 5, userId: process.env.PROXY_USER, password: process.env.PROXY_PASS },
    Number(process.env.SOCKET_TIMEOUT),
    webNonce
  );
  const cookie = await steamcommunity.login();

  // get inventory and farm data
  const items = await steamcommunity.getCardsInventory();
  const farmData = await steamcommunity.getFarmingData();

  const auth = loginRes.auth as ExtendedAccountAuth;
  auth.cookie = cookie;
  const data = loginRes.data as ExtendedAccountData;
  data.items = items;
  data.farmData = farmData;

  console.log(`CONNECTED: ${loginOptions.accountName}`);
  return { auth, data, steam: loginRes.steam };
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
      userId: process.env.PROXY_USER,
      password: process.env.PROXY_PASS,
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
  await steam.connect(socksOptions, Number(process.env.SOCKET_TIMEOUT));

  // attempt cm login
  const res = await steam.login(loginOptions);

  return {
    auth: res.auth,
    data: res.data,
    steam,
  };
}

/**
 * Restore accounts personastate, farming, and idling after login
 * @helper
 */
async function restoreAccountState(steam: Steam, steamAccount: SteamAccount): Promise<void> {
  steam.clientChangeStatus({ personaState: steamAccount.state.personaState as PersonaState });

  if (steamAccount.state.isFarming) {
    // restore farming
    return;
  }

  // restore idling
  if (steamAccount.state.gamesIdling.length) {
    steam.clientGamesPlayed(steamAccount.state.gamesIdling);
  }
}

/**
 * @listener
 */
function accountDisconnectListener(userId: string, username: string, steam: Steam) {
  steam.on("disconnected", async (err) => {
    console.log(`DISCONNECTED: ${username}`);
    console.log(`\t error: ${err.syscall} ${err.code}`);
    
    // remove from online accounts
    SteamStore.remove(userId, username);

    // stop farming interval if exists
    //stopFarmingInterval(userId, accountName);

    // set state.status to 'reconnecting'
    await SteamAccountModel.updateField(userId, username, { "state.status": "reconnecting" });

    const operation = new retry({ retries: 10, interval: 5000 });

    // attempt login
    operation.attempt(async (currentAttempt: number) => {
      console.log(`Attempting reconnect #${currentAttempt}: ${username}`);

      try {
        await login(userId, username);
      } catch (error) {
        console.log(`Reconnect attempt #${currentAttempt} failed: ${username} - error: ${error}`);

        if (currentAttempt > 1) {
          // got auth error after first try, stop trying to reconnect.
          if (isAuthError(error)) {
            return;
          }
        }

        // retry operation
        if (operation.retry()) {
          return;
        }

        console.log(error);

        // reconnect failed, set status to offline
        await SteamAccountModel.updateField(userId, username, { "state.status": "offline" });
      }
    });
  });
}

function isVerificationError(error: string): boolean {
  return (
    error === "AccountLogonDenied" || // need email code
    error === "TwoFactorCodeMismatch" || // invalid mobile code
    error === "AccountLoginDeniedNeedTwoFactor" || // need mobile code
    error === "InvalidLoginAuthCode" // invalid email code
  );
}

function isAuthError(error: string): boolean {
  return isVerificationError(error) || error === "InvalidPassword";
}
