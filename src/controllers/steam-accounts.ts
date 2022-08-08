import Steam, { LoginOptions, Options, SteamClientError } from "steam-client";
import retry from "@machiavelli/retry";

import SteamStore from "../models/steam-store.js";
import * as SteamAccountModel from "../models/steam-accounts.js";
import * as ProxyModel from "../models/proxies.js";
import * as SteamcmModel from "../models/steam-servers.js";
import * as SteamVerifyModel from "../models/steam-verifications.js";

import { ERRORS, eventEmitter, isAuthError, isSteamGuardError } from "../commons.js";
import * as Farmer from "./farmer.js";
import { AccountState, LoginRes, Proxy, SteamAccount } from "../../@types";
import { steamWebLogin } from "./steamcommunity-actions.js";

/**
 * Add new account
 * @controller
 */
export async function add(userId: string, username: string, password: string, code?: string) {
  if (await SteamAccountModel.get(userId, username)) throw ERRORS.EXISTS;

  // set login options
  const loginOptions: LoginOptions = {
    accountName: username,
    password: password,
  };

  // check if account is waiting for steam guard code
  const steamVerify = await SteamVerifyModel.get(userId, username);
  if (steamVerify) {
    // steam guard code was not provided
    if (!code) throw new SteamClientError(steamVerify.authType);

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
    if (error instanceof SteamClientError && isSteamGuardError(error.message)) {
      // save this config to reuse when user enters the code
      await SteamVerifyModel.add({
        userId,
        username: loginOptions.accountName,
        proxy,
        authType: error.message,
        createdAt: new Date(),
      });
    }
    throw error;
  }

  // account does not have steam guard enabled
  if (!steamCMLoginRes.data.secure) {
    throw ERRORS.ENABLE_STEAM_GUARD;
  }

  // account is locked
  if (steamCMLoginRes.data.communityBanned || steamCMLoginRes.data.locked) {
    throw ERRORS.LOCKED_ACCOUNT;
  }

  // login to steamcommunity
  const { cookie, steamcommunity } = await steamWebLogin({
    type: "login",
    login: { steamid: steamCMLoginRes.data.steamId, webNonce: steamCMLoginRes.auth.webNonce, proxy },
  });

  // Create account model
  const steamAccount: SteamAccount = {
    userId,
    username,
    auth: {
      ...steamCMLoginRes.auth,
      cookie,
      password,
      type: steamVerify.authType === "AccountLogonDenied" ? "email" : "mobile",
    },
    data: {
      ...steamCMLoginRes.data,
      farmableGames: await steamcommunity.getFarmableGames(),
      items: await steamcommunity.getCardsInventory(),
    },
    state: {
      status: "online",
      personaState: "online",
      farming: false,
      gamesIdsIdle: [],
      proxy: proxy,
    },
  };

  // remove steam-verify
  await SteamVerifyModel.remove(userId, username);

  // add to store
  SteamStore.add(userId, username, steamCMLoginRes.steam);

  await SteamAccountModel.add(steamAccount);
  await ProxyModel.increaseLoad(proxy);
  SteamEventListeners(userId, username);
}

/**
 * login a Steam account
 * @controller
 */
export async function login(userId: string, username: string, code?: string, password?: string) {
  if (SteamStore.has(userId, username)) {
    throw ERRORS.ALREADY_ONLINE;
  }

  // check account is not online
  const steamAccount = await SteamAccountModel.get(userId, username);
  if (!steamAccount) throw ERRORS.NOTFOUND;

  // set password
  steamAccount.auth.password = password ? password : steamAccount.auth.password;

  // set login options
  const loginOptions: LoginOptions = {
    accountName: username,
    password: steamAccount.auth.password,
    machineName: steamAccount.auth.machineName,
    loginKey: steamAccount.auth.loginKey,
    shaSentryfile: steamAccount.auth.sentry,
  };

  // don't use loginkey or sentry after auth error
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

  console.log(loginOptions);

  let steamClient: Steam = null;

  try {
    // attempt CM login
    const { auth, data, steam } = await steamcmLogin(loginOptions, steamAccount.state.proxy);
    steamClient = steam;
    // set new auth
    steamAccount.auth.loginKey = auth.loginKey;
    steamAccount.auth.sentry = auth.sentry;
    steamAccount.auth.webNonce = auth.webNonce;
    // set new data
    steamAccount.data = data;
  } catch (error) {
    if (error instanceof SteamClientError) {
      await SteamAccountModel.updateField(userId, username, {
        "state.error": error.message,
      });
    }
    throw error;
  }

  // update auth
  await SteamAccountModel.updateField(userId, username, { auth: steamAccount.auth } as SteamAccount);

  // login to steamcommunity
  const { cookie, steamcommunity } = await steamWebLogin({
    type: "login",
    login: {
      steamid: steamAccount.data.steamId,
      webNonce: steamAccount.auth.webNonce,
      proxy: steamAccount.state.proxy,
    },
  });

  // update auth again with cookie
  steamAccount.auth.cookie = cookie;
  await SteamAccountModel.updateField(userId, username, { auth: steamAccount.auth } as SteamAccount);

  // renew FarmableGames and cardsInventory
  steamAccount.data.farmableGames = await steamcommunity.getFarmableGames();
  steamAccount.data.items = await steamcommunity.getCardsInventory();

  // update data, state.error, state.status
  await SteamAccountModel.updateField(userId, username, {
    data: steamAccount.data,
    "state.error": "",
    "state.status": "online",
  });

  // save to store
  SteamStore.add(userId, username, steamClient);

  await restoreState(userId, username, steamAccount.state);
  SteamEventListeners(userId, username);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function logout(userId: string, username: string) {
  if (!(await SteamAccountModel.get(userId, username))) throw ERRORS.NOTFOUND;

  // account is online
  const steam = SteamStore.get(userId, username);
  if (steam) {
    await Farmer.stop(userId, username);
    steam.disconnect();
    SteamStore.remove(userId, username);
  }

  await SteamAccountModel.updateField(userId, username, {
    "state.status": "offline" as SteamAccount["state"]["status"],
  });
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
 * Restore account state:  personastate, farming, and idling after login
 */
async function restoreState(userId: string, username: string, state: AccountState) {
  const steam = SteamStore.get(userId, username);
  if (!steam) throw ERRORS.NOTONLINE;
  steam.changePersonaState(state.personaState);

  // restore farming
  if (state.farming) {
    return await Farmer.start(userId, username);
  }

  // restore idling
  if (state.gamesIdsIdle.length) {
    steam.idleGames(state.gamesIdsIdle);
  }
}

/**
 * Handle account disconnects
 */
function SteamEventListeners(userId: string, username: string) {
  const steam = SteamStore.get(userId, username);
  if (!steam) throw ERRORS.NOTONLINE;

  steam.on("loginKey", async (loginKey) => {
    // get steam account because auth can't get updated partiarlly
    const steamAccount = await SteamAccountModel.get(userId, username);
    steamAccount.auth.loginKey = loginKey;
    await SteamAccountModel.updateField(userId, username, { auth: steamAccount.auth } as SteamAccount);
  });

  steam.on("disconnected", async () => {
    // remove from online accounts
    SteamStore.remove(userId, username);

    // stop farmer
    await Farmer.stop(userId, username);

    // set state.status to 'reconnecting'
    await SteamAccountModel.updateField(userId, username, {
      "state.status": "reconnecting" as SteamAccount["state"]["status"],
    });

    // generate a number between 1 and 20
    // this is done so that when steam goes offline, the backend doesn't overload.
    const seconds = Math.floor(Math.random() * 20 + 1);
    const retries = Number(process.env.STEAM_RECONNECTS_RETRIES);
    const operation = new retry({ retries, interval: seconds * 1000 });

    // attempt login
    operation.attempt(async (currentAttempt: number) => {
      console.log(`${username}: attempting reconnect...`);

      try {
        await login(userId, username);
        eventEmitter.emit("reconnected");
        console.log(`${username}: reconnected successfully`);
      } catch (error) {
        console.log(`${username}: reconnect failed try #${currentAttempt} of ${retries}`);

        // error originated in steam-client
        if (error instanceof SteamClientError) {
          // relogin failed after 1st attempt using loginKey or sentry, stop retrying
          if (currentAttempt > 1 && isAuthError(error.message)) return;

          // Steam is down
          if (error.message === "ServiceUnavailable") {
            console.log(`${username}: STEAM IS DOWN, increasing retry interval to 10 minutes`);
            // increase interval to 10 minutes
            operation.setNewConfig({
              retries: Number(process.env.STEAM_DOWN_RETRIES),
              interval: Number(process.env.STEAM_DOWN_INTERVAL),
            });
          }
        }

        // retry operation
        if (operation.retry()) return;

        // reconnect failed
        await SteamAccountModel.updateField(userId, username, {
          "state.status": "offline",
        });

        eventEmitter.emit("reconnectFailed");
      }
    });
  });
}
