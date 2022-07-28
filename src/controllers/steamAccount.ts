import Steam, { LoginOptions, Options, PersonaState } from "steam-client";
import SteamCommunity, { Options as SteamWebOptions } from "steamcommunity-api";
import retry from "@machiavelli/retry";

import SteamStore from "./steamStore.js";
import * as SteamAccountModel from "../models/steamAccount.js";
import * as ProxyModel from "../models/proxy.js";
import * as SteamcmModel from "../models/steamcm.js";
import * as SteamVerifyModel from "../models/steamVerify.js";

import { SteamAccount, LoginRes, Proxy } from "../../@types";
import { ERRORS } from "../commons.js";

const SteamGuardError: string[] = ["AccountLogonDenied", "AccountLoginDeniedNeedTwoFactor"];
const BadSteamGuardCode: string[] = ["InvalidLoginAuthCode", "TwoFactorCodeMismatch"];
const BadPassword: string[] = ["InvalidPassword"];

const isSteamGuardError = (error: string) => SteamGuardError.includes(error);
const isBadSteamGuardCode = (error: string) => BadSteamGuardCode.includes(error);
const isBadPassword = (error: string) => BadPassword.includes(error);
const isAuthError = (error: string) => isSteamGuardError(error) || isBadSteamGuardCode(error) || isBadPassword(error);

const PERSONASTATE = {
  Offline: 0,
  Online: 1,
  Busy: 2,
  Away: 3,
  Snooze: 4,
} as const;

/**
 * Add new account
 * @controller
 */
export async function add(userId: string, username: string, password: string, code?: string) {
  if (await SteamAccountModel.exists(userId, username)) {
    throw ERRORS.EXISTS;
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
      throw steamVerify.authType;
    }

    // set code to loginOptions
    if (steamVerify.authType === "AccountLogonDenied") {
      loginOptions.authCode = code;
    } else {
      loginOptions.twoFactorCode = code;
    }
  }

  // use previous proxy if account was waiting for steam guard code
  const proxy = steamVerify ? steamVerify.proxy : await ProxyModel.getOne();

  let steamCMLoginRes: LoginRes;
  try {
    // attempt CM login
    steamCMLoginRes = await steamcmLogin(loginOptions, proxy);
  } catch (error) {
    // Steam is asking for guard code
    if (isSteamGuardError(error)) {
      // save this config to reuse when user enters the code
      await SteamVerifyModel.add({
        userId,
        username: loginOptions.accountName,
        proxy,
        authType: error,
      });
    }
    // error is steam error code or unexpected
    throw normalizeLoginErrors(error);
  }

  // account does not have steam guard enabled
  if (steamCMLoginRes.data.secure) {
    throw ERRORS.ENABLE_STEAM_GUARD;
  }

  if (steamCMLoginRes.data.communityBanned || steamCMLoginRes.data.locked) {
    throw ERRORS.LOCKED_ACCOUNT;
  }

  const steamWebLoginRes = await steamWebLogin(steamCMLoginRes, proxy);

  // remove steam-verify
  await SteamVerifyModel.remove(userId, username);

  // add to store
  SteamStore.add(userId, username, steamCMLoginRes.steam);

  // Create account model
  const steamAccount: SteamAccount = {
    userId,
    username,
    auth: {
      ...steamCMLoginRes.auth,
      ...steamWebLoginRes.auth,
      password,
      type: steamVerify.authType === "AccountLogonDenied" ? "email" : "mobile",
    },
    data: {
      ...steamCMLoginRes.data,
      ...steamWebLoginRes.data,
    },
    state: {
      status: "online",
      personaState: PERSONASTATE.Online as PersonaState,
      isFarming: false,
      gamesIdling: [],
      gamesFarming: [],
      proxy: proxy,
    },
  };

  await SteamAccountModel.add(steamAccount);
  await ProxyModel.increaseLoad(proxy);
  SteamEventListeners(userId, username, steamCMLoginRes.steam);
}

/**
 * login a Steam account
 * @controller
 */
export async function login(userId: string, username: string, code?: string, password?: string) {
  if (SteamStore.has(userId, username)) {
    throw ERRORS.ALREADY_ONLINE;
  }

  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw ERRORS.EXISTS;
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
  if (isAuthError(steamAccount.state.authError)) {
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

  let steamCMLoginRes: LoginRes;
  try {
    // attempt CM login
    steamCMLoginRes = await steamcmLogin(loginOptions, steamAccount.state.proxy);
  } catch (error) {
    // authentication errors, update account state error
    if (isAuthError(error)) {
      await SteamAccountModel.updateField(userId, username, { "state.authError": error });
    }
    throw normalizeLoginErrors(error);
  }

  // update steam account before proceeding because loginKey and sentry could change
  steamAccount.auth.loginKey = steamCMLoginRes.auth.loginKey;
  steamAccount.auth.sentry = steamCMLoginRes.auth.sentry;
  await SteamAccountModel.update(steamAccount);

  const steamWebLoginRes = await steamWebLogin(steamCMLoginRes, steamAccount.state.proxy);

  // save to store
  SteamStore.add(userId, username, steamCMLoginRes.steam);

  // update steam account
  steamAccount.auth = {
    ...steamCMLoginRes.auth,
    ...steamWebLoginRes.auth,
    type: steamAccount.auth.type,
    password: password ? password : steamAccount.auth.password,
  };

  steamAccount.data = {
    ...steamCMLoginRes.data,
    ...steamWebLoginRes.data,
  };

  steamAccount.state.status = "online";
  delete steamAccount.state.authError;
  await SteamAccountModel.update(steamAccount);

  restoreAccountState(steamCMLoginRes.steam, steamAccount);
  SteamEventListeners(userId, username, steamCMLoginRes.steam);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function logout(userId: string, username: string) {
  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) {
    throw ERRORS.NOTFOUND;
  }

  // account is online
  const steam = SteamStore.get(userId, username);
  if (steam) {
    steam.disconnect();
    SteamStore.remove(userId, username);
    // TO DO: stop farming
  }

  //change necessary steamaccount states
  steamAccount.state.status = "offline";
  await SteamAccountModel.update(steamAccount);

  console.log(`LOGOUT: ${username}`);
}

/**
 * Remove a Steam account
 * @controller
 */
export async function remove(userId: string, username: string) {
  await logout(userId, username);
  const steamAccount = await SteamAccountModel.remove(userId, username);
  await ProxyModel.decreaseLoad(steamAccount.state.proxy);
}

/**
 * Login to Steam via web
 */
async function steamWebLogin(loginRes: LoginRes, proxy: Proxy) {
  const options: SteamWebOptions = {
    steamid: loginRes.data.steamId,
    webNonce: loginRes.auth.webNonce,
    agentOptions: {
      host: proxy.ip,
      port: proxy.port,
      userId: process.env.PROXY_USER,
      password: process.env.PROXY_PASS,
    },
  };

  try {
    const steamcommunity = new SteamCommunity(options);
    return {
      auth: { cookie: await steamcommunity.login() },
      data: { items: await steamcommunity.getCardsInventory(), farmData: await steamcommunity.getFarmingData() },
    };
  } catch (error) {
    throw normalizeLoginErrors(error);
  }
}

/**
 * Login to steam via CM
 */
async function steamcmLogin(loginOptions: LoginOptions, proxy: Proxy): Promise<LoginRes> {
  const steamcm = await SteamcmModel.getOne();
  const options: Options = {
    proxy: {
      host: proxy.ip,
      port: proxy.port,
      type: Number(process.env.PROXY_TYPE) as 4 | 5,
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
    steam,
    ...res,
  };
}

/**
 * Restore account personastate, farming, and idling after login
 */
function restoreAccountState(steam: Steam, steamAccount: SteamAccount) {
  steam.clientChangeStatus({ personaState: steamAccount.state.personaState as PersonaState });

  if (steamAccount.state.isFarming) {
    // TO DO: restore farming
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
function SteamEventListeners(userId: string, username: string, steam: Steam) {
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
function normalizeLoginErrors(error: string | Error): string {
  if (typeof error !== "string") {
    console.error(error);
    return ERRORS.UNEXPECTED;
  }
  return error;
}
