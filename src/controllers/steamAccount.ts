import Steam, { LoginOptions, PersonaState } from "steam-client";
import SteamCommunity from "steamcommunity-api";
import * as SteamAccountModel from "../models/steamAccount.js";
import * as ProxyModel from "../models/proxy.js";
import * as SteamcmModel from "../models/steamcm.js";
import * as SteamVerifyModel from "../models/steamVerify.js";
import SteamStore from "./steamStore.js";
import retry from "@machiavelli/retry";
import { Options } from "steam-client/@types/connection.js";
import {
  ExtendedLoginRes,
  SteamAccount,
  LoginRes,
  ExtendedAccountAuth,
  ExtendedAccountData,
  SteamCM,
  Proxy,
} from "../../@types/index.js";

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
    throw "AlreadyOnline";
  }

  if (await SteamAccountModel.exists(userId, username)) {
    throw "Exists";
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
      throw "SteamGuardCodeNeeded";
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
    if (isSteamGuardCodeNeededError(error)) {
      // save this config to reuse when user enters the code
      await SteamVerifyModel.add({
        userId,
        username: loginOptions.accountName,
        proxy,
        authType: error === "AccountLogonDenied" ? "email" : "mobile",
      });
      throw "SteamGuardCodeNeeded";
    } else if (isBadSteamGuardCodeError(error)) {
      throw "BadSteamGuardCode";
    }

    // error is steam error code or unexpected
    throw normalizeLoginErrors(error);
  }

  // login successful

  // remove steam-verify
  await SteamVerifyModel.remove(userId, username);

  // add to store
  SteamStore.add(userId, username, loginRes.steam);

  // Create account model
  const steamAccount: SteamAccount = {
    userId,
    username,
    auth: { ...loginRes.auth, password, type: steamVerify ? steamVerify.authType : "none" },
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
  // increase proxy load
  await ProxyModel.increaseLoad(proxy);
  // listen to disconnects
  disconnectHandler(userId, username, loginRes.steam);
}

/**
 * login a Steam account
 * @controller
 */
export async function login(userId: string, username: string, code?: string, password?: string): Promise<void> {
  if (SteamStore.has(userId, username)) {
    throw "AlreadyOnline";
  }

  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw "DoesNotExist";
  }

  // set login options
  const loginOptions: LoginOptions = {
    accountName: username,
    password: password ? password : steamAccount.auth.password,
    machineName: steamAccount.auth.machineName,
    loginKey: steamAccount.auth.loginKey,
    shaSentryfile: steamAccount.auth.sentry as Buffer,
  };

  // don't use loginkey after auth error
  if (isAuthError(steamAccount.state.error)) {
    delete loginOptions.loginKey;
    delete loginOptions.shaSentryfile;
  }

  // code passed
  if (code) {
    if (steamAccount.auth.type === "email") {
      loginOptions.authCode = code;
    } else {
      loginOptions.twoFactorCode = code;
    }
  }

  // attempt login to cm and web
  let loginRes: ExtendedLoginRes;
  try {
    loginRes = await fullyLogin(loginOptions, steamAccount.state.proxy);
  } catch (error) {
    // authentication errors, update account state error
    if (isAuthError(error)) {
      let stateError = error;
      if (isSteamGuardCodeNeededError(error)) {
        stateError = "SteamGuardCodeNeeded";
      } else if (isBadSteamGuardCodeError(error)) {
        stateError = "BadSteamGuardCode";
      }
      await SteamAccountModel.updateField(userId, username, { "state.error": stateError });
      throw stateError;
    }

    // update loginkey and sentry on web login fail
    if (error.msg && error.msg === "SteamWebLoginFailed") {
      const loginRes = error.loginRes as LoginRes;
      steamAccount.auth.loginKey = loginRes.auth.loginKey;
      steamAccount.auth.sentry = loginRes.auth.sentry;
      await SteamAccountModel.update(steamAccount);
    }
    throw normalizeLoginErrors(error);
  }

  // save to store
  SteamStore.add(userId, username, loginRes.steam);

  // update steam account
  steamAccount.auth = {
    ...loginRes.auth,
    type: steamAccount.auth.type,
    password: password ? password : steamAccount.auth.password,
  };
  steamAccount.data = loginRes.data;
  steamAccount.state.status = "online";
  delete steamAccount.state.error;
  await SteamAccountModel.update(steamAccount);

  await restoreAccountState(loginRes.steam, steamAccount);
  // listen to disconnects
  disconnectHandler(userId, username, loginRes.steam);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function logout(userId: string, username: string): Promise<void> {
  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw "DoesNotExist";
  }

  const steam = SteamStore.get(userId, username);
  if (steam) {
    steam.disconnect();
    SteamStore.remove(userId, username);
  }

  //change necessary steamaccount states
  steamAccount.state.status = "offline";
  await SteamAccountModel.update(steamAccount);

  console.log(`LOGOUT: ${username}`);

  //stop farming
  //todo
}

/**
 * Remove a Steam account
 * @controller
 */
export async function remove(userId: string, username: string): Promise<void> {
  const steamAccount = await SteamAccountModel.remove(userId, username);
  if (!steamAccount) {
    throw "DoesNotExist";
  }
  const steam = SteamStore.remove(userId, username);
  if (steam) {
    steam.disconnect();
    // stop farming
    // todo
  }
  // decrease proxy load
  await ProxyModel.decreaseLoad(steamAccount.state.proxy);
}

/**
 * Fully login a Steam account
 */
async function fullyLogin(loginOptions: LoginOptions, proxy: Proxy): Promise<ExtendedLoginRes> {
  const steamcm = await SteamcmModel.getOne();
  // attempt CM login
  const loginRes = await steamcmLogin(loginOptions, proxy, steamcm);

  // attempt steamcommunity login
  // throw with loginRes from steamcmLogin,
  // loginkey and sentry have to be updated in login controller
  let webRes;
  try {
    webRes = await steamWebLogin(loginRes, proxy);
  } catch (error) {
    throw { msg: "SteamWebLoginFailed", error, loginRes };
  }

  const auth = loginRes.auth as ExtendedAccountAuth;
  auth.cookie = webRes.cookie;
  const data = loginRes.data as ExtendedAccountData;
  data.items = webRes.items;
  data.farmData = webRes.farmData;

  console.log(`CONNECTED: ${loginOptions.accountName}`);
  return { auth, data, steam: loginRes.steam };
}

/**
 * Login to Steam via web
 */
async function steamWebLogin(loginRes: LoginRes, proxy: Proxy) {
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
  const items = await steamcommunity.getCardsInventory();
  const farmData = await steamcommunity.getFarmingData();

  return {
    cookie,
    items,
    farmData,
  };
}

/**
 * Login to steam via CM
 */
async function steamcmLogin(loginOptions: LoginOptions, proxy: Proxy, steamcm: SteamCM): Promise<LoginRes> {
  const options: Options = {
    proxy: {
      host: proxy.ip,
      port: proxy.port,
      type: 5,
      userId: process.env.PROXY_USER,
      password: process.env.PROXY_PASS,
    },
    steamCM: {
      host: steamcm.ip,
      port: steamcm.port,
    },
    timeout: Number(process.env.PROXY_TIMEOUT),
  };

  const steam = new Steam(options);
  await steam.connect();
  const res = await steam.login(loginOptions);

  return {
    auth: res.auth,
    data: res.data,
    steam,
  };
}

/**
 * Restore account personastate, farming, and idling after login
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
 * Handle account disconnects
 */
function disconnectHandler(userId: string, username: string, steam: Steam) {
  steam.on("loginKey", () => console.log(`loginKey: ${username}`));

  steam.on("disconnected", async () => {
    console.log(`DISCONNECTED: ${username}`);

    // remove from online accounts
    SteamStore.remove(userId, username);

    // stop farming interval if exists
    // stopFarmingInterval(userId, accountName);

    // set state.status to 'reconnecting'
    await SteamAccountModel.updateField(userId, username, { "state.status": "reconnecting" });

    // generate a number between 1 and 20
    // this is done so that when steam goes offline, the backend doesn't overload.
    const seconds = Math.floor(Math.random() * (20 - 5 + 1) + 5);
    const retries = Number(process.env.STEAM_RECONNECTS_RETRIES);
    const operation = new retry({ retries, interval: seconds * 1000 });
    let steamIsDown = false;

    // attempt login
    operation.attempt(async (currentAttempt: number) => {
      console.log(`Attempting reconnect #${currentAttempt} of ${retries}: ${username}`);

      try {
        await login(userId, username);
      } catch (error) {
        console.log(`Reconnect attempt #${currentAttempt} of ${retries} failed: ${username} - error: ${error}`);

        // got auth error after first try, stop retrying.
        if (currentAttempt > 1) {
          if (isAuthError(error)) {
            return;
          }
        }

        // Steam is down increase interval to 10 minutes
        if (error === "ServiceUnavailable") {
          if (!steamIsDown) {
            steamIsDown = true;
            console.log(`STEAM IS DOWN, increasing retry interval to 10 minutes: ${username}`);
            operation.setNewConfig({
              retries: Number(process.env.STEAM_DOWN_RETRIES),
              interval: Number(process.env.STEAM_DOWN_INTERVAL),
            });
          }
        }

        // retry operation
        if (operation.retry()) {
          return;
        }

        // reconnect failed, set status to offline
        await SteamAccountModel.updateField(userId, username, { "state.status": "offline" });
      }
    });
  });
}

/**
 * Normalizes error so that only string errors are thrown
 */
function normalizeLoginErrors(error: string | Error) {
  if (typeof error !== "string") {
    console.error(error);
    return "UnexpectedError";
  }
  return error;
}

function isSteamGuardCodeNeededError(error: string): boolean {
  return (
    error === "AccountLogonDenied" || // need email code
    error === "AccountLoginDeniedNeedTwoFactor" || // need mobile code
    error === "SteamGuardCodeNeeded"
  );
}

function isBadSteamGuardCodeError(error: string) {
  return (
    error === "InvalidLoginAuthCode" || // bad email code
    error === "TwoFactorCodeMismatch" || // bad mobile code
    error === "BadSteamGuardCode"
  );
}

function isAuthError(error: string): boolean {
  return isSteamGuardCodeNeededError(error) || isBadSteamGuardCodeError(error) || error === "InvalidPassword";
}
