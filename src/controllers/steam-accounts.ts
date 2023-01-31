import retry from "@machiavelli/retry";

import SteamStore from "../models/steam-store.js";
import * as SteamAccountModel from "../models/steam-accounts.js";
import * as ProxyModel from "../models/proxies.js";
import * as SteamAccountService from "../services/steam-account.js";

import { ERRORS, SteamIdlerError } from "../commons.js";
import * as Farmer from "./farmer.js";
import { AccountState, LoginRes, Proxy, SteamAccount } from "../../@types";
import { ObjectId } from "mongodb";
import { LoginOptions } from "@machiavelli/steam-client";
import { WebSocket } from "ws";
import { AddAccountBody, LoginBody, UpdateWithSteamGuardCodeBody } from "../../@types/addSteamAccount";

/**
 * Add new account
 * @controller
 */
export async function add(userId: ObjectId, body: AddAccountBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.authType) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  if (body.authType !== "QRcode" && body.authType !== "SteamGuardCode") {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  if (body.authType === "SteamGuardCode" && !body.accountName && !body.password) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  // lowercase accountName
  if (body.accountName) body.accountName = body.accountName.toLocaleLowerCase();

  await SteamAccountService.add(userId, body, ws);
}

export async function updateWithSteamGuardCode(userId: ObjectId, body: UpdateWithSteamGuardCodeBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.code) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.updateWithSteamGuardCode(userId, body, ws);
}

/**
 * login a Steam account
 * @controller
 */
export async function login(userId: ObjectId, body: LoginBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.login(userId, body, ws);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function logout(userId: ObjectId, body: LoginBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.logout(userId, body, ws);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function reObtainAccess(userId: ObjectId, body: AddAccountBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.authType) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  if (body.authType !== "QRcode" && body.authType !== "SteamGuardCode") {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  if (body.authType === "SteamGuardCode" && !body.accountName && !body.password) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  // lowercase accountName
  if (body.accountName) body.accountName = body.accountName.toLocaleLowerCase();

  await SteamAccountService.reObtainAccess(userId, body, ws);
}

/**
 * Remove a Steam account
 * @controller
 */
export async function remove(userId: ObjectId, username: string) {
  //await logout(userId, username);
  const steamAccount = await SteamAccountModel.remove(userId, username);
  await ProxyModel.decreaseLoad(steamAccount.state.proxy);
}

/**
 * Login to steam via CM
 */
async function steamcmLogin(loginOptions: LoginOptions, proxy: Proxy): Promise<LoginRes> {
  return null;
}

/**
 * Restore account state:  personastate, farming, and idling after login
 */
async function restoreState(userId: ObjectId, username: string, state: AccountState) {
  const steam = SteamStore.get(userId, username);
  if (!steam) throw new SteamIdlerError(ERRORS.NOTONLINE);

  steam.client.setPersonaState(state.personaState.personaState);

  // restore farming
  if (state.farming) {
    return await Farmer.start(userId, username);
  }

  // restore idling
  if (state.gamesIdsIdle.length) {
    steam.client.gamesPlayed(state.gamesIdsIdle);
  }
}

/**
 * Handle account disconnects
 */
function SteamEventListeners(userId: ObjectId, username: string) {
  const steam = SteamStore.get(userId, username);
  if (!steam) throw new SteamIdlerError(ERRORS.NOTONLINE);

  // steam.on("disconnected", async () => {
  //   // remove from online accounts
  //   SteamStore.remove(userId, username);

  //   // stop farmer
  //   await Farmer.stop(userId, username);

  //   // set state.status to 'reconnecting'
  //   await SteamAccountModel.updateField(userId, username, {
  //     "state.status": "reconnecting" as SteamAccount["state"]["status"],
  //   });

  //   // generate a number between 1 and 20
  //   // this is done so that when steam goes offline, the backend doesn't overload.
  //   const seconds = Math.floor(Math.random() * 20 + 1);
  //   const retries = Number(process.env.STEAM_RECONNECTS_RETRIES);
  //   const operation = new retry({ retries, interval: seconds * 1000 });

  //   // attempt login
  //   operation.attempt(async (currentAttempt: number) => {
  //     console.log(`${username}: attempting reconnect...`);

  //     try {
  //       await login(userId, username);
  //       eventEmitter.emit("reconnected");
  //       console.log(`${username}: reconnected successfully`);
  //     } catch (error) {
  //       console.log(`${username}: reconnect failed try #${currentAttempt} of ${retries}`);

  //       // error originated in steam-client
  //       // if (error instanceof SteamClientError) {
  //       //   // relogin failed after 1st attempt using loginKey or sentry, stop retrying
  //       //   if (currentAttempt > 1 && isAuthError(error.message)) return;

  //       //   // Steam is down
  //       //   if (error.message === "ServiceUnavailable") {
  //       //     console.log(`${username}: STEAM IS DOWN, increasing retry interval to 10 minutes`);
  //       //     // increase interval to 10 minutes
  //       //     operation.setNewConfig({
  //       //       retries: Number(process.env.STEAM_DOWN_RETRIES),
  //       //       interval: Number(process.env.STEAM_DOWN_INTERVAL),
  //       //     });
  //       //   }
  //       // }

  //       // retry operation
  //       if (operation.retry()) return;

  //       // reconnect failed
  //       await SteamAccountModel.updateField(userId, username, {
  //         "state.status": "offline",
  //       });

  //       eventEmitter.emit("reconnectFailed");
  //     }
  //   });
  // });
}
