import SteamStore from "../models/steam-store.js";
import * as SteamAccountModel from "../models/steam-accounts.js";
import * as ProxyModel from "../models/proxies.js";
import * as SteamcmModel from "../models/steam-servers.js";
import * as Farmer from "../controllers/farmer.js";
import Steam, { SteamClientError } from "@machiavelli/steam-client";
import { steamWebLogin } from "../controllers/steamcommunity-actions.js";
import retry from "@machiavelli/retry";

import { ERRORS, SteamIdlerError } from "../commons.js";
import { AccountState, Proxy, SteamAccount } from "../../@types";
import { ObjectId } from "mongodb";
import { LoginOptions } from "@machiavelli/steam-client";
import { WebSocket } from "ws";
import { AddAccountBody, LoginBody, LogoutBody, UpdateWithSteamGuardCodeBody } from "../../@types/addSteamAccount.js";
import { AuthTokens, Confirmation } from "@machiavelli/steam-client/@types/services/Auth.js";

/**
 * Add new account
 * @service
 */
export async function add(userId: ObjectId, body: AddAccountBody, ws: WebSocket) {
  // check account already exists
  if (body.accountName) {
    if (await SteamAccountModel.get(userId, body.accountName)) {
      throw new SteamIdlerError("Account already exists.");
    }
  }

  // connect to steam
  const { steam, proxy } = await connectToSteam();
  ws.sendInfo("steamaccount/add", "Connected to Steam.");

  // get auth tokens
  const authTokens = await getAuthtokens("add", body, steam, ws);

  // check if account already exists
  if (body.authType === "QRcode") {
    if (await SteamAccountModel.get(userId, authTokens.accountName)) {
      throw new SteamIdlerError("Account already exists.");
    }
  }

  ws.sendInfo("steamaccount/add", "Signin in to Steam.");

  // login to steam
  const loginData = await steamcmLogin(authTokens, steam);
  ws.sendInfo("steamaccount/add", "Signed in to steam servers.");
  const { items, farmableGames } = await steamWebLogin(authTokens.accessToken);
  loginData.data.items = items;
  loginData.data.farmableGames = farmableGames;
  ws.sendInfo("steamaccount/add", "Signed in to steam web.");

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
  SteamStore.add(userId, authTokens.accountName, steam);

  delete steamaccount.auth;
  delete steamaccount.state.proxy;
  ws.sendMessage("steamaccount/add", steamaccount);
}

/**
 * login a Steam account
 * @service
 */
export async function login(userId: ObjectId, body: LoginBody, ws: WebSocket) {
  // get account
  let steamAccount = await SteamAccountModel.get(userId, body.accountName);
  if (!steamAccount) {
    throw new SteamIdlerError("Account was not found.");
  }

  if (SteamStore.has(userId, body.accountName)) {
    throw new SteamIdlerError("Account is already online.");
  }

  // connect to steam
  const { steam } = await connectToSteam(steamAccount.state.proxy);
  if (ws) ws.sendInfo("steamaccount/login", "Connected to Steam.");

  // login to steam
  let loginData;
  try {
    loginData = await steamcmLogin(steamAccount.auth.authTokens, steam);
    if (ws) ws.sendInfo("steamaccount/login", "Signed in to steam servers.");
  } catch (error) {
    // update steam account status
    if (error.message === "AccessDenied") {
      await SteamAccountModel.updateField(userId, body.accountName, {
        "state.status": "AccessDenied" as SteamAccount["state"]["status"],
      });
    }
    throw error;
  }

  const { items, farmableGames } = await steamWebLogin(steamAccount.auth.authTokens.accessToken);
  loginData.data.items = items;
  loginData.data.farmableGames = farmableGames;
  if (ws) ws.sendInfo("steamaccount/login", "Signed in to steam web.");

  // update account
  await SteamAccountModel.updateField(userId, body.accountName, {
    "state.status": "online" as SteamAccount["state"]["status"],
    "data.items": items,
    "dat.farmableGames": farmableGames,
  });

  // store steam instance
  SteamStore.add(userId, steamAccount.accountName, steam);

  SteamEventListeners(userId, steamAccount.accountName);

  steamAccount = { ...steamAccount, ...loginData };
  delete steamAccount.auth;
  delete steamAccount.state.proxy;
  if (ws) ws.sendMessage("steamaccount/login", steamAccount);
}

/**
 * reobtain authTokens, and login
 * @service
 */
export async function reObtainAccess(userId: ObjectId, body: AddAccountBody, ws: WebSocket) {
  // get account
  let steamAccount = await SteamAccountModel.get(userId, body.accountName);
  if (!steamAccount) {
    throw new SteamIdlerError("Account was not found.");
  }

  if (SteamStore.has(userId, body.accountName)) {
    throw new SteamIdlerError("Account is already online.");
  }

  if (steamAccount.state.status !== "AccessDenied") {
    throw new SteamIdlerError("Account does not need to re-obtain auth Tokens.");
  }

  // connect to steam
  const { steam } = await connectToSteam(steamAccount.state.proxy);
  ws.sendInfo("steamaccount/reobtainaccess", "Connected to Steam.");

  // get auth tokens
  const authTokens = await getAuthtokens("add", body, steam, ws);

  // login to steam
  const data = await steamcmLogin(authTokens, steam);
  ws.sendInfo("steamaccount/reobtainaccess", "Signed in to steam servers.");
  await steamWebLogin(steamAccount.auth.authTokens.accessToken);
  ws.sendInfo("steamaccount/reobtainaccess", "Signed in to steam web.");

  // update account
  await SteamAccountModel.updateField(userId, body.accountName, {
    auth: { ...steamAccount.auth, authTokens },
    "state.status": "online" as SteamAccount["state"]["status"],
  });

  SteamStore.add(userId, steamAccount.accountName, steam);
  SteamEventListeners(userId, steamAccount.accountName);
  delete steamAccount.auth;
  ws.sendMessage("steamaccount/reobtainaccess", steamAccount);
}

/**
 * updateWithSteamGuardCode
 * @service
 */
export async function updateWithSteamGuardCode(userId: ObjectId, body: UpdateWithSteamGuardCodeBody, ws: WebSocket) {
  if (!ws.listeners("updateWithSteamGuardCode").length) {
    ws.sendError(404, "updateWithSteamGuardCode", "Not waiting for confirmation.");
  } else {
    ws.emit("updateWithSteamGuardCode", body);
  }
}

/**
 * Logout a Steam account
 * @service
 */
export async function logout(userId: ObjectId, body: LogoutBody, ws: WebSocket) {
  if (!(await SteamAccountModel.get(userId, body.accountName))) throw new SteamIdlerError(ERRORS.NOTFOUND);

  // account is online
  const steam = SteamStore.get(userId, body.accountName);
  if (steam) {
    // await Farmer.stop(userId, username);
    steam.disconnect();
    SteamStore.remove(userId, body.accountName);
  }

  await SteamAccountModel.updateField(userId, body.accountName, {
    "state.status": "offline" as SteamAccount["state"]["status"],
  });

  ws.sendMessage("steamaccount/logout", "Logged out.");
}

/**
 * Remove a Steam account
 * @controller
 */
export async function remove(userId: ObjectId, username: string) {
  await logout(userId, { accountName: username }, null);
  const steamAccount = await SteamAccountModel.remove(userId, username);
  await ProxyModel.decreaseLoad(steamAccount.state.proxy);
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

async function getAuthtokens(routeName: string, body: AddAccountBody, steam: Steam, ws: WebSocket) {
  // register event before getting authTokens
  steam.once("waitingForConfirmation", (confirmation: Confirmation) => {
    // got confirmation from user
    if (confirmation.guardType && (confirmation.guardType === "emailCode" || confirmation.guardType === "deviceCode")) {
      ws.once("updateWithSteamGuardCode", (body: UpdateWithSteamGuardCodeBody) => {
        ws.sendInfo(`steamaccount/${routeName}`, "Submitting Steam Guard Code.");
        steam.service.auth.updateWithSteamGuardCode(body.code, confirmation.guardType);
      });
    }

    // send confirmation request to user
    ws.sendInfo(`steamaccount/${routeName}->waitingForConfirmation`, confirmation);
  });

  // get authTokens
  let authTokens;
  try {
    if (body.authType === "QRcode") {
      authTokens = await steam.service.auth.getAuthTokensViaQR("image");
    } else if (body.authType === "SteamGuardCode") {
      // sumit SteamGuardCode to steam
      authTokens = await steam.service.auth.getAuthTokensViaCredentials(body.accountName, body.password);
      console.log(authTokens);
    }
  } catch (error) {
    steam.disconnect();
    throw error;
  }
  return authTokens;
}

/**
 * Restore account state:  personastate, farming, and idling after login
 */
async function restoreState(userId: ObjectId, username: string, state: AccountState) {
  const steam = SteamStore.get(userId, username);
  if (!steam) throw new SteamIdlerError(ERRORS.NOTONLINE);

  steam.client.setPersonaState(state.personaState.personaState);

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
  const steam = SteamStore.get(userId, accountName);
  if (!steam) throw new SteamIdlerError(ERRORS.NOTONLINE);

  steam.on("disconnected", async () => {
    // remove from online accounts
    SteamStore.remove(userId, accountName);

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
        await login(userId, { accountName }, null);
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
