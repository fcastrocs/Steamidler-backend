import * as SteamAccountModel from "../models/steam-accounts.js";
import * as ProxyModel from "../models/proxies.js";
import * as SteamcmModel from "../models/steam-servers.js";
import * as Farmer from "../controllers/farmer.js";
import Steam, { SteamClientError } from "@machiavelli/steam-client";
import { steamWebLogin } from "../services/steamweb.js";
import retry from "@machiavelli/retry";

import { ERRORS, SteamIdlerError } from "../commons.js";
import { AccountState, Proxy, SteamAccount } from "../../@types";
import { ObjectId } from "mongodb";
import { LoginOptions } from "@machiavelli/steam-client";
import {
  AddAccountBody,
  GetBody,
  LoginBody,
  LogoutBody,
  RemoveBody,
  UpdateWithSteamGuardCodeBody,
} from "../../@types/addSteamAccount.js";
import { AuthTokens, Confirmation } from "@machiavelli/steam-client";

import { wsServer, steamStore, steamTempStore } from "../app.js";

/**
 * Add new account
 * @service
 * emits "steamaccount/add" -> steamaccount
 */
export async function add(userId: ObjectId, body: AddAccountBody) {
  const wsBody = { userId, routeName: "steamaccount/add" };

  // check account already exists
  if (body.accountName) {
    if (await SteamAccountModel.getByAccountName(body.accountName)) {
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
    if (await SteamAccountModel.getByAccountName(authTokens.accountName)) {
      throw new SteamIdlerError("Account already exists.");
    }
  }

  wsServer.send({ ...wsBody, type: "Info", message: "Signin in to Steam." });

  // login to steam
  const loginData = await steamcmLogin(authTokens, steam);

  wsServer.send({ ...wsBody, type: "Info", message: "Signed in to steam servers." });

  const { items, farmableGames } = await steamWebLogin(authTokens.accessToken, proxy);
  loginData.data.items = items;
  loginData.data.farmableGames = farmableGames;

  wsServer.send({ ...wsBody, type: "Info", message: "Signed in to steam web." });

  const steamaccount: SteamAccount = {
    userId,
    accountName: authTokens.accountName,
    state: {
      farming: false,
      status: "online",
      personaState: null,
      gamesIdsIdle: [],
      proxy: { ip: proxy.ip, port: proxy.port },
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
  delete steamaccount.state.proxy;

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
  let steamAccount = await SteamAccountModel.get(userId, body.accountName);
  if (!steamAccount) {
    throw new SteamIdlerError("Account was not found.");
  }

  if (steamStore.get(userId, body.accountName)) {
    throw new SteamIdlerError("Account is already online.");
  }

  // connect to steam
  const { steam } = await connectToSteam(steamAccount.state.proxy);

  wsServer.send({ ...wsBody, type: "Info", message: "Connected to Steam." });

  // login to steam
  let loginData;
  try {
    loginData = await steamcmLogin(steamAccount.auth.authTokens, steam);
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

  // login to steam web
  const { items, farmableGames } = await steamWebLogin(
    steamAccount.auth.authTokens.accessToken,
    steamAccount.state.proxy
  );
  loginData.data.items = items;
  loginData.data.farmableGames = farmableGames;
  wsServer.send({ ...wsBody, type: "Info", message: "Signed in to steam web." });

  // update account
  await SteamAccountModel.updateField(userId, body.accountName, {
    "state.status": "online" as SteamAccount["state"]["status"],
    "data.items": items,
    "dat.farmableGames": farmableGames,
  });

  // store steam instance
  steamStore.add(userId, steamAccount.accountName, steam);

  // restore account state
  await restoreState(userId, body.accountName, steamAccount.state);
  // add listeners
  SteamEventListeners(userId, steamAccount.accountName);

  steamAccount = { ...steamAccount, ...loginData };
  delete steamAccount.auth;
  delete steamAccount.state.proxy;
  wsServer.send({ ...wsBody, type: "Success", message: steamAccount });
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
  if (!(await SteamAccountModel.get(userId, body.accountName))) throw new SteamIdlerError(ERRORS.NOTFOUND);

  // account is online
  const steam = steamStore.get(userId, body.accountName);
  if (steam) {
    // await Farmer.stop(userId, username);
    steam.disconnect();
    steamStore.remove(userId, body.accountName);
  }

  await SteamAccountModel.updateField(userId, body.accountName, {
    "state.status": "offline" as SteamAccount["state"]["status"],
  });

  wsServer.send({ userId, routeName: "steamaccount/logout", type: "Success" });
}

/**
 * reobtain authTokens, and login
 * @service
 * emits "steamaccount/authrenew" -> null
 */
export async function authRenew(userId: ObjectId, body: AddAccountBody) {
  // get account
  let steamAccount = await SteamAccountModel.get(userId, body.accountName);
  if (!steamAccount) {
    throw new SteamIdlerError("Account was not found.");
  }

  if (steamStore.get(userId, body.accountName)) {
    throw new SteamIdlerError("Account is already online.");
  }

  if (steamAccount.state.status !== "AccessDenied") {
    throw new SteamIdlerError("Account does not need to renew auth tokens.");
  }

  // connect to steam
  const { steam } = await connectToSteam(steamAccount.state.proxy);
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
  await logout(userId, { accountName: body.accountName });
  const steamAccount = await SteamAccountModel.remove(userId, body.accountName);
  await ProxyModel.decreaseLoad(steamAccount.state.proxy);
  wsServer.send({ userId, routeName: "steamaccount/remove", type: "Success" });
}

/**
 * Get a Steam account
 * @Service
 * emits "steamaccount/get" -> steamaccount
 */
export async function get(userId: ObjectId, body: GetBody) {
  const steamAccount = await SteamAccountModel.get(userId, body.accountName);
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

  //steam.client.setPersonaState(state.personaState.personaState);

  // restore farming
  // if (state.farming) {
  //   return await Farmer.start(userId, username);
  // }

  // restore idling
  if (state.gamesIdsIdle.length) {
    steam.client.gamesPlayed(state.gamesIdsIdle);
  }
}

/**
 * Handle account disconnects
 */
function SteamEventListeners(userId: ObjectId, accountName: string) {
  const steam = steamStore.get(userId, accountName);
  if (!steam) throw new SteamIdlerError("Account is not online.");

  steam.on("PersonaStateChanged", async (state) => {
    wsServer.send({ userId, routeName: "PersonaStateChanged", type: "Info", message: state });
    await SteamAccountModel.updateField(userId, accountName, {
      "data.state": state,
    });
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
  });

  steam.on("disconnected", async () => {
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
