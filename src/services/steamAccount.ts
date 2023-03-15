/**
 * 'steamaccount/add'
 * 'steamaccount/login'
 * 'steamaccount/waitingforconfirmation'
 * 'steamaccount/confirmed'
 * 'steamaccount/cancelconfirmation'
 * 'steamaccount/updatewithsteamguardcode'
 * 'steamaccount/logout'
 * 'steamaccount/authrenew'
 * 'steamaccount/remove'
 * 'steamaccount/get'
 * 'steamaccount/getall'
 * 'steamaccount/personastatechanged'
 * 'steamaccount/playingstatechanged'
 * 'steamaccount/reconnecting'
 */

import * as SteamAccountModel from "../models/steamAccount.js";
import * as ProxyModel from "../models/proxy.js";
import * as SteamcmModel from "../models/steamServer.js";
import * as Farming from "../services/farming.js";
import Steam, { SteamClientError } from "@fcastrocs/steamclient";
import { steamWebLogin } from "./steamWeb.js";
import retry from "@fcastrocs/retry";

import { mergeGamesArrays, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import { AuthTokens, Confirmation, LoginOptions } from "@fcastrocs/steamclient";

import { wsServer, steamStore, steamConfirmationStore } from "../app.js";
import {
  AddAccountBody,
  UpdateWithSteamGuardCodeBody,
  RemoveBody,
  GetBody,
  LoginBody,
  LogoutBody,
  CancelConfirmationBody,
} from "../../@types/controllers/steamAccount.js";
import { SteamAccount, SteamAccountNonSensitive } from "../../@types/models/steamAccount.js";

/**
 * Add new account
 * @service
 * emits "steamaccount/add" -> steamaccount
 */
export async function add(userId: ObjectId, body: AddAccountBody) {
  const wsBody = { userId, routeName: "steamaccount/add" };

  // check account already exists
  if (body.accountName) {
    if (await SteamAccountModel.get({ accountName: body.accountName })) {
      throw new SteamIdlerError("Account already exists.");
    }
  }

  if (steamConfirmationStore.get(userId, body.accountName)) {
    throw new SteamIdlerError("Account is waiting for confirmation.");
  }

  // connect to steam
  const { steam, proxy } = await connectToSteam();
  wsServer.send({ ...wsBody, type: "Info", message: "Connected to Steam." });

  // get auth tokens
  const authTokens = await getAuthtokens(userId, body, steam);

  wsServer.send({ ...wsBody, type: "Info", message: "Received auth tokens." });

  // check if account already exists, update authtokens, then throw
  if (body.authType === "QRcode") {
    const steamAccount = await SteamAccountModel.get({ accountName: authTokens.accountName });
    if (steamAccount) {
      await SteamAccountModel.updateField(userId, body.accountName, {
        "auth.authtokens": authTokens as SteamAccount["auth"]["authTokens"],
      });
      throw new SteamIdlerError("Account already exists.");
    }
  }

  wsServer.send({ ...wsBody, type: "Info", message: "Signin in to Steam." });

  // login to steam
  const loginData = await steamcmLogin(steam, authTokens);

  wsServer.send({ ...wsBody, type: "Info", message: "Signed in to steam servers." });

  const { farmableGames, avatarFrame } = await steamWebLogin(authTokens.accessToken, proxy);
  loginData.data.farmableGames = farmableGames;
  loginData.data.avatarFrame = avatarFrame;

  wsServer.send({ ...wsBody, type: "Info", message: "Signed in to steam web." });

  const steamaccount: SteamAccount = {
    userId,
    accountName: authTokens.accountName,
    steamId: loginData.data.steamId,
    state: {
      status: "online",
      gamesIdsIdle: [],
      gamesIdsFarm: [],
      proxyId: proxy._id,
      personaState: "Offline",
    },
    ...loginData,
  };

  // save account
  steamaccount.auth.authTokens = authTokens;
  await SteamAccountModel.add(steamaccount);
  steamStore.add(userId, authTokens.accountName, steam);

  // add listeners
  SteamEventListeners(steam, userId, steamaccount.accountName);

  delete steamaccount.auth;

  wsServer.send({ ...wsBody, type: "Success", message: steamaccount });
}

/**
 * login a Steam account
 * @service
 * emits "steamaccount/login" -> steamaccount
 */
export async function login(userId: ObjectId, body: LoginBody) {
  const wsBody = { userId, routeName: "steamaccount/login" };

  // get account
  let steamAccount = await SteamAccountModel.getByUserId(userId, { accountName: body.accountName });
  if (!steamAccount) {
    throw new SteamIdlerError("Account was not found.");
  }

  if (steamStore.get(userId, body.accountName)) {
    throw new SteamIdlerError("Account is already online.");
  }

  // get proxy
  let proxy = await ProxyModel.getById(steamAccount.state.proxyId);
  if (!proxy) {
    proxy = await ProxyModel.getOne();
    steamAccount.state.proxyId = proxy._id;
  }

  // connect to steam
  const { steam } = await connectToSteam(proxy);

  wsServer.send({ ...wsBody, type: "Info", message: "Connected to Steam." });

  // login to steam
  let loginRes;
  try {
    loginRes = await steamcmLogin(steam, steamAccount.auth.authTokens, steamAccount.auth.machineName);
    wsServer.send({ ...wsBody, type: "Info", message: "Signed in to steam servers." });
  } catch (error) {
    // update steam account status
    if (error.message === "AccessDenied") {
      await SteamAccountModel.updateField(userId, body.accountName, {
        "state.status": "AccessDenied" as SteamAccount["state"]["status"],
      });
    }
    throw error;
  }

  // merge games so that activated f2p games are not lost
  const { merge } = mergeGamesArrays(steamAccount.data.games, loginRes.data.games);
  loginRes.data.games = merge;

  // login to steam web
  const { farmableGames, avatarFrame } = await steamWebLogin(steamAccount.auth.authTokens.refreshToken, proxy);
  wsServer.send({ ...wsBody, type: "Info", message: "Signed in to steam web." });

  // update account
  loginRes.data.farmableGames = farmableGames;
  loginRes.data.avatarFrame = avatarFrame;
  steamAccount.data = loginRes.data;

  steamStore.add(userId, steamAccount.accountName, steam);

  await restoreState(userId, steam, steamAccount);

  const nonSensitiveAccount = await SteamAccountModel.updateField(userId, body.accountName, {
    "state.proxyId": proxy._id,
    data: loginRes.data,
  });

  // add listeners
  SteamEventListeners(steam, userId, steamAccount.accountName);

  wsServer.send({ ...wsBody, type: "Success", message: nonSensitiveAccount });
}

/**
 *  emits "steamaccount/waitingforconfirmation" -> confirmation
 */
async function getAuthtokens(userId: ObjectId, body: AddAccountBody, steam: Steam) {
  // register event before getting authTokens
  steam.on("waitingForConfirmation", (confirmation: Confirmation) => {
    if (!steamConfirmationStore.get(userId, body.accountName)) {
      steamConfirmationStore.add(userId, body.accountName, steam);
    }
    // send confirmation request to user
    wsServer.send({ userId, type: "Info", routeName: "steamaccount/waitingforconfirmation", message: confirmation });
  });

  // get authTokens
  let authTokens;
  try {
    if (body.authType === "QRcode") {
      authTokens = await steam.service.auth.getAuthTokensViaQR("image");
    } else if (body.authType === "SteamGuardCode") {
      authTokens = await steam.service.auth.getAuthTokensViaCredentials(body.accountName, body.password);
    }

    steamConfirmationStore.remove(userId, body.accountName);
    wsServer.send({ userId, type: "Success", routeName: "steamaccount/confirmed" });
  } catch (error) {
    steamConfirmationStore.remove(userId, body.accountName);
    steam.disconnect();
    throw error;
  }
  return authTokens;
}

/**
 * cancel confirmation for steam account
 * @service
 * emits "steamaccount/cancelconfirmation" -> null
 */
export async function cancelConfirmation(userId: ObjectId, body: CancelConfirmationBody) {
  const steam = steamConfirmationStore.remove(userId, body.accountName);
  if (steam) {
    steam.disconnect();
    steam.removeAllListeners("waitingForConfirmation");
  }
  wsServer.send({ userId, type: "Success", routeName: "steamaccount/cancelconfirmation" });
}

/**
 * updateWithSteamGuardCode
 * @service
 * emits "steamaccount/updateWithSteamGuardCode" -> null
 */
export async function updateWithSteamGuardCode(userId: ObjectId, body: UpdateWithSteamGuardCodeBody) {
  const steam = steamConfirmationStore.get(userId, body.accountName);

  if (!steam) {
    return wsServer.send({
      userId,
      type: "Error",
      routeName: "steamaccount/updatewithsteamguardcode",
      message: "Account is not waiting for confirmation.",
    });
  }

  await steam.service.auth.updateWithSteamGuardCode(body.code, body.guardType);

  return wsServer.send({
    userId,
    type: "Success",
    routeName: "steamaccount/updatewithsteamguardcode",
  });
}

/**
 * Logout a Steam account
 * @service
 * emits "steamaccount/logout" -> null
 */
export async function logout(userId: ObjectId, body: LogoutBody) {
  if (!(await SteamAccountModel.getByUserId(userId, { accountName: body.accountName })))
    throw new SteamIdlerError("Account was not found.");

  // account is online
  const steam = steamStore.get(userId, body.accountName);
  if (steam) {
    await stopFarming(userId, body.accountName);
    steam.disconnect();
  } else {
    throw new SteamIdlerError("Account is not online.");
  }

  steamStore.remove(userId, body.accountName);

  const nonSensitiveAcc = await SteamAccountModel.updateField(userId, body.accountName, {
    "state.status": "offline" as SteamAccount["state"]["status"],
  });

  wsServer.send({ userId, routeName: "steamaccount/logout", type: "Success", message: nonSensitiveAcc });
}

/**
 * reobtain authTokens, and login
 * @service
 * emits "steamaccount/authrenew" -> null
 */
export async function authRenew(userId: ObjectId, body: AddAccountBody) {
  // get account
  let steamAccount = await SteamAccountModel.getByUserId(userId, { accountName: body.accountName });
  if (!steamAccount) {
    throw new SteamIdlerError("Account was not found.");
  }

  if (steamStore.get(userId, body.accountName)) {
    throw new SteamIdlerError("Account is already online.");
  }

  if (steamAccount.state.status !== "AccessDenied") {
    throw new SteamIdlerError("Account does not need to renew auth tokens.");
  }

  const proxy = await ProxyModel.getById(steamAccount.state.proxyId);

  // connect to steam
  const { steam } = await connectToSteam(proxy);
  wsServer.send({ userId, routeName: "steamaccount/authrenew", type: "Info", message: "Connected to Steam." });

  // disconnect from steam
  steam.disconnect();

  // get auth tokens
  const authTokens = await getAuthtokens(userId, body, steam);

  // update steam account auth
  await SteamAccountModel.updateField(userId, body.accountName, {
    auth: { ...steamAccount.auth, authTokens },
  });

  wsServer.send({ userId, routeName: "steamaccount/authrenew", type: "Success" });
}

/**
 * Remove a Steam account
 * @Service
 * emits "steamaccount/remove" -> null
 */
export async function remove(userId: ObjectId, body: RemoveBody) {
  const steam = steamStore.get(userId, body.accountName);
  if (steam) {
    steam.disconnect();
    steamStore.remove(userId, body.accountName);
    wsServer.send({ userId, routeName: "steamaccount/remove", type: "Info", message: "Account logged out." });
  }
  const steamAccount = await SteamAccountModel.remove(userId, body.accountName);
  wsServer.send({ userId, routeName: "steamaccount/remove", type: "Info", message: "Account removed from database." });

  await ProxyModel.decreaseLoad(steamAccount.state.proxyId);
  wsServer.send({ userId, routeName: "steamaccount/remove", type: "Success", message: steamAccount });
}

/**
 * Get a Steam account
 * @Service
 * emits "steamaccount/get" -> steamaccount
 */
export async function get(userId: ObjectId, body: GetBody) {
  const steamAccount = await SteamAccountModel.getByUserId(userId, body);
  delete steamAccount.auth;
  wsServer.send({ userId, routeName: "steamaccount/get", type: "Success", message: steamAccount });
}

/**
 * Get all Steam account
 * @Service
 * emits "steamaccount/getall" -> steamAccounts[]
 */
export async function getAll(userId: ObjectId) {
  const steamAccounts = await SteamAccountModel.getAll(userId);
  wsServer.send({ userId, routeName: "steamaccount/getall", type: "Success", message: steamAccounts });
}

async function steamcmLogin(steam: Steam, authtokens: AuthTokens, machineName?: string) {
  const loginOptions: LoginOptions = {
    accountName: authtokens.accountName,
    accessToken: authtokens.refreshToken,
    machineName,
  };
  return steam.login(loginOptions);
}

async function connectToSteam(proxy?: Proxy) {
  if (!proxy) {
    proxy = await ProxyModel.getOne();
  }

  const steamCM = await SteamcmModel.getOne();

  // connect to steam
  const steam = new Steam({
    steamCM: { host: steamCM.ip, port: steamCM.port },
    proxy: {
      host: proxy.ip,
      port: proxy.port,
      userId: process.env.PROXY_USER,
      password: process.env.PROXY_PASS,
      type: Number(process.env.PROXY_TYPE) as any,
    },
  });
  await steam.connect();
  return { steam, proxy };
}

async function stopFarming(userId: ObjectId, accountName: string) {
  try {
    await Farming.stop(userId, { accountName });
  } catch (error) {
    if (error.message !== "Not farming.") {
      steamStore.remove(userId, accountName);
      throw error;
    }
  }
}

/**
 * Restore account state:  personastate, farming, and idling after login
 */
async function restoreState(userId: ObjectId, steam: Steam, s: SteamAccount | SteamAccountNonSensitive) {
  if (!steam.isPlayingBlocked) {
    // restore idling or idling
    if (s.state.gamesIdsFarm.length) {
      await Farming.start(userId, { accountName: s.accountName, gameIds: s.state.gamesIdsFarm });
    }

    // restore idling
    if (s.state.gamesIdsIdle.length) {
      await steam.client.gamesPlayed(s.state.gamesIdsIdle);
    }
  }

  await SteamAccountModel.updateField(userId, s.accountName, {
    "state.status":
      (s.state.gamesIdsFarm.length || s.state.gamesIdsIdle.length) && !steam.isPlayingBlocked
        ? "ingame"
        : ("online" as SteamAccount["state"]["status"]),
  });
}

/**
 * Handle steam account events
 */
function SteamEventListeners(steam: Steam, userId: ObjectId, accountName: string) {
  // state change on this steam account
  steam.on("PersonaStateChanged", async (state) => {
    const steamAccount = await SteamAccountModel.updateField(userId, accountName, {
      "data.state": state,
    });

    wsServer.send({ userId, routeName: "steamaccount/personastatechanged", type: "Info", message: steamAccount });
  });

  steam.on("PlayingStateChanged", async (state) => {
    const oldSteamAccount = await SteamAccountModel.getByUserId(userId, { accountName });

    const steamAccount = await SteamAccountModel.updateField(userId, accountName, {
      "data.playingState": state,
    });

    // stated changed from blocked to not blocked
    if (
      oldSteamAccount.data.playingState.playingBlocked &&
      !state.playingBlocked &&
      oldSteamAccount.state.status === "online"
    ) {
      await restoreState(userId, steam, steamAccount);
    }

    wsServer.send({ userId, routeName: "steamaccount/playingstatechanged", type: "Info", message: steamAccount });
  });

  steam.on("AccountLoggedOff", async (eresult) => {
    console.log(`ACCOUNT ${accountName} LOGGED OFF eresult: ${eresult}`);

    // access revoked
    if (eresult === "Revoked") {
      await SteamAccountModel.updateField(userId, accountName, {
        "state.status": "AccessDenied" as SteamAccount["state"]["status"],
      });
    }

    reconnect(eresult);
  });

  steam.on("disconnected", () => {
    console.log(`ACCOUNT ${accountName} DISCONNECTED.`);
    reconnect();
  });

  async function reconnect(eresult?: string) {
    // set state.status to 'reconnecting'
    const steamAccount = await SteamAccountModel.updateField(userId, accountName, {
      "state.status": "reconnecting" as SteamAccount["state"]["status"],
    });

    wsServer.send({
      userId,
      routeName: "steamaccount/reconnecting",
      type: "Info",
      message: { steamAccount, eresult: eresult },
    });

    // stop farmer
    await stopFarming(userId, accountName);

    // remove from online accounts
    steamStore.remove(userId, accountName);

    // stop
    if (eresult && eresult === "Revoked") {
      return;
    }

    // generate a number between 1 and 20
    // this is done so that when steam goes offline, the backend doesn't overload.
    const seconds = Math.floor(Math.random() * 20 + 1);
    const retries = Number(process.env.STEAM_RECONNECTS_RETRIES);
    const operation = new retry({ retries, interval: seconds * 1000 });

    // attempt login
    operation.attempt(async (currentAttempt: number) => {
      try {
        await login(userId, { accountName });
        console.log(`${accountName}: reconnected successfully.`);
        return;
      } catch (error) {
        console.log(error);
        console.log(`${accountName}: reconnect failed try #${currentAttempt} of ${retries}.`);

        // error originated in steam-client
        if (error instanceof SteamClientError) {
          // relogin failed after 1st attempt because of AccessDenied
          if (currentAttempt > 1 && error.message === "AccessDenied") return;

          // Steam is down
          if (error.message === "ServiceUnavailable") {
            console.log(`${accountName}: STEAM IS DOWN, increasing retry interval to 10 minutes`);
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
        await SteamAccountModel.updateField(userId, accountName, {
          "state.status": "offline" as SteamAccount["state"]["status"],
        });
      }
    });
  }
}
