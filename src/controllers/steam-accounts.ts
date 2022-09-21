import retry from "@machiavelli/retry";

import SteamStore from "../models/steam-store.js";
import * as SteamAccountModel from "../models/steam-accounts.js";
import * as ProxyModel from "../models/proxies.js";
import * as SteamcmModel from "../models/steam-servers.js";
import * as SteamVerifyModel from "../models/steam-verifications.js";

import { ERRORS, eventEmitter, isAuthError, isSteamGuardError, SteamIdlerError } from "../commons.js";
import * as Farmer from "./farmer.js";
import { AccountState, LoginRes, Proxy, SteamAccount } from "../../@types";
import { steamWebLogin } from "./steamcommunity-actions.js";
import { ObjectId } from "mongodb";
import { LoginOptions } from "@machiavelli/steam-client";

/**
 * Add new account
 * @controller
 */
export async function add(userId: ObjectId, username: string, password: string, code?: string) {
  if (await SteamAccountModel.get(userId, username)) throw new SteamIdlerError(ERRORS.EXISTS);
  //
}

/**
 * login a Steam account
 * @controller
 */
export async function login(userId: ObjectId, username: string, code?: string, password?: string) {
  //
}

/**
 * Logout a Steam account
 * @controller
 */
export async function logout(userId: ObjectId, username: string) {
  if (!(await SteamAccountModel.get(userId, username))) throw new SteamIdlerError(ERRORS.NOTFOUND);

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
export async function remove(userId: ObjectId, username: string) {
  await logout(userId, username);
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

  steam.client.setPersonaState(state.personaState);

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
