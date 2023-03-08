import * as SteamAccountModel from "../models/steamAccount.js";
import * as ProxyModel from "../models/proxy.js";
import * as SteamcmModel from "../models/steamServer.js";
import * as Farming from "../services/farming.js";
import Steam, { SteamClientError } from "@machiavelli/steam-client";
import { steamWebLogin } from "./steamWeb.js";
import retry from "@machiavelli/retry";

import { ERRORS, mergeGamesArrays, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import { AuthTokens, Confirmation, LoginOptions } from "@machiavelli/steam-client";

import { wsServer, steamStore, steamTempStore } from "../app.js";
import {
  AddAccountBody,
  UpdateWithSteamGuardCodeBody,
  RemoveBody,
  GetBody,
  LoginBody,
  LogoutBody,
  CancelConfirmationBody,
} from "../../@types/controllers/steamAccount.js";
import { SteamAccount, AccountState } from "../../@types/models/steamAccount.js";

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

  if (steamTempStore.get(userId, body.accountName)) {
    throw new SteamIdlerError("Account is waiting for confirmation.");
  }

  // connect to steam
  const { steam, proxy } = await connectToSteam();
  wsServer.send({ ...wsBody, type: "Info", message: "Connected to Steam." });

  // get auth tokens
  const authTokens = await getAuthtokens(userId, body, steam);

  wsServer.send({ ...wsBody, type: "Info", message: "Received auth tokens." });

  // check if account already exists
  if (body.authType === "QRcode") {
    if (await SteamAccountModel.get({ accountName: authTokens.accountName })) {
      throw new SteamIdlerError("Account already exists.");
    }
  }

  wsServer.send({ ...wsBody, type: "Info", message: "Signin in to Steam." });

  // login to steam
  const loginData = await steamcmLogin(authTokens, steam);

  wsServer.send({ ...wsBody, type: "Info", message: "Signed in to steam servers." });

  const { items, farmableGames, avatarFrame } = await steamWebLogin(authTokens.accessToken, proxy);
  loginData.data.items = items;
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
  SteamEventListeners(userId, steamaccount.accountName);

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
    loginRes = await steamcmLogin(steamAccount.auth.authTokens, steam);
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
  const { items, farmableGames, avatarFrame } = await steamWebLogin(steamAccount.auth.authTokens.refreshToken, proxy);
  wsServer.send({ ...wsBody, type: "Info", message: "Signed in to steam web." });

  // update account
  loginRes.data.items = items;
  loginRes.data.farmableGames = farmableGames;
  loginRes.data.avatarFrame = avatarFrame;

  const nonSensitiveAccount = await SteamAccountModel.updateField(userId, body.accountName, {
    "state.status": "online" as SteamAccount["state"]["status"],
    "state.proxyId": proxy._id,
    data: loginRes.data,
  });

  // store steam instance
  steamStore.add(userId, steamAccount.accountName, steam);

  // restore account state
  await restoreState(userId, body.accountName, steamAccount.state);

  // add listeners
  SteamEventListeners(userId, steamAccount.accountName);

  wsServer.send({ ...wsBody, type: "Success", message: nonSensitiveAccount });
}

/**
 *  emits "steamaccount/waitingForConfirmation" -> confirmation
 */
async function getAuthtokens(userId: ObjectId, body: AddAccountBody, steam: Steam) {
  // register event before getting authTokens
  steam.on("waitingForConfirmation", (confirmation: Confirmation) => {
    if (!steamTempStore.get(userId, body.accountName)) {
      steamTempStore.add(userId, body.accountName, steam);
    }
    // send confirmation request to user
    wsServer.send({ userId, type: "Info", routeName: "steamaccount/waitingForConfirmation", message: confirmation });
  });

  // get authTokens
  let authTokens;
  try {
    if (body.authType === "QRcode") {
      authTokens = await steam.service.auth.getAuthTokensViaQR("image");
    } else if (body.authType === "SteamGuardCode") {
      authTokens = await steam.service.auth.getAuthTokensViaCredentials(body.accountName, body.password);
    }

    steamTempStore.remove(userId, body.accountName);
    wsServer.send({ userId, type: "Success", routeName: "steamaccount/confirmedByUser" });
  } catch (error) {
    steamTempStore.remove(userId, body.accountName);
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
  const steam = steamTempStore.remove(userId, body.accountName);
  if (steam) {
    steam.removeAllListeners("waitingForConfirmation");
  }
  wsServer.send({ type: "Success", routeName: "steamaccount/cancelConfirmation", userId });
}

/**
 * updateWithSteamGuardCode
 * @service
 * emits "steamaccount/updateWithSteamGuardCode" -> null
 */
export async function updateWithSteamGuardCode(userId: ObjectId, body: UpdateWithSteamGuardCodeBody): Promise<void> {
  const steam = steamTempStore.get(userId, body.accountName);

  if (!steam) {
    return wsServer.send({
      userId,
      type: "Error",
      routeName: "steamaccount/updateWithSteamGuardCode",
      message: "Account is not waiting for confirmation.",
    });
  }

  await steam.service.auth.updateWithSteamGuardCode(body.code, body.guardType);

  return wsServer.send({
    userId,
    type: "Success",
    routeName: "steamaccount/updateWithSteamGuardCode",
  });
}

/**
 * Logout a Steam account
 * @service
 * emits "steamaccount/logout" -> null
 */
export async function logout(userId: ObjectId, body: LogoutBody) {
  if (!(await SteamAccountModel.getByUserId(userId, { accountName: body.accountName })))
    throw new SteamIdlerError(ERRORS.NOTFOUND);

  // account is online
  const steam = steamStore.get(userId, body.accountName);
  if (steam) {
    // await Farmer.stop(userId, username);
    steam.disconnect();
    steamStore.remove(userId, body.accountName);
  }

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
  wsServer.send({ userId, routeName: "steamaccount/remove", type: "Success", message: steamAccount.accountName });
}

/**
 * Get a Steam account
 * @Service
 * emits "steamaccount/get" -> steamaccount
 */
export async function get(userId: ObjectId, body: GetBody) {
  const steamAccount = await SteamAccountModel.getByUserId(userId, body);
  delete steamAccount.auth;
  delete steamAccount.userId;
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

async function steamcmLogin(authtokens: AuthTokens, steam: Steam) {
  const loginOptions: LoginOptions = {
    accountName: authtokens.accountName,
    accessToken: authtokens.refreshToken,
  };
  return await steam.login(loginOptions);
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

/**
 * Restore account state:  personastate, farming, and idling after login
 */
async function restoreState(userId: ObjectId, accountName: string, state: AccountState) {
  const steam = steamStore.get(userId, accountName);
  if (!steam) throw new SteamIdlerError("Account is not online.");

  if (state.personaState !== "Invisible") {
    await steam.client.setPersonaState(state.personaState);
  }

  // restore farming
  if (state.gamesIdsFarm.length) {
    return await Farming.start(userId, { accountName, gameIds: state.gamesIdsFarm });
  }

  // restore idling
  if (state.gamesIdsIdle.length) {
    await steam.client.gamesPlayed(state.gamesIdsIdle);
  }
}

/**
 * Handle account disconnects
 */
function SteamEventListeners(userId: ObjectId, accountName: string) {
  const steam = steamStore.get(userId, accountName);
  if (!steam) throw new SteamIdlerError("Account is not online.");

  // state change on this steam account
  steam.on("PersonaStateChanged", async (state) => {
    const steamAccount = await SteamAccountModel.updateField(userId, accountName, {
      "data.state": state,
    });

    wsServer.send({ userId, routeName: "steamaccount/personastatechanged", type: "Info", message: steamAccount });
  });

  steam.on("AccountLoggedOff", async (eresult) => {
    await logout(userId, { accountName });
    // access revoked
    if (eresult === "Revoked") {
      await SteamAccountModel.updateField(userId, accountName, {
        "state.status": "AccessDenied" as SteamAccount["state"]["status"],
      });
    }
    console.log(`ACCOUNT ${accountName} LOGGED OFF eresult: ${eresult}`);
    wsServer.send({
      userId,
      routeName: "steamaccount/accountloggedoff",
      type: "Info",
      message: { accountName, eresult },
    });
  });

  steam.on("disconnected", async () => {
    wsServer.send({
      userId,
      routeName: "steamaccount/disconnected",
      type: "Info",
      message: { accountName },
    });

    // remove from online accounts
    steamStore.remove(userId, accountName);

    // stop farmer
    //await Farmer.stop(userId, username);

    // set state.status to 'reconnecting'
    await SteamAccountModel.updateField(userId, accountName, {
      "state.status": "reconnecting" as SteamAccount["state"]["status"],
    });

    // generate a number between 1 and 20
    // this is done so that when steam goes offline, the backend doesn't overload.
    const seconds = Math.floor(Math.random() * 20 + 1);
    const retries = Number(process.env.STEAM_RECONNECTS_RETRIES);
    const operation = new retry({ retries, interval: seconds * 1000 });

    // attempt login
    operation.attempt(async (currentAttempt: number) => {
      console.log(`${accountName}: attempting reconnect...`);

      try {
        await login(userId, { accountName });
        console.log(`${accountName}: reconnected successfully`);
      } catch (error) {
        console.log(`${accountName}: reconnect failed try #${currentAttempt} of ${retries}`);

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
  });
}
