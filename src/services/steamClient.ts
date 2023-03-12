/**
 * 'steamclient/idlegames'
 * 'steamclient/changeplayername'
 * 'steamclient/activatef2pgame'
 * 'steamclient/cdkeyredeem'
 * 'steamclient/changepersonastate'
 */

import * as SteamAccountModel from "../models/steamAccount.js";
import { mergeGamesArrays, SteamAccountExistsOnline, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import { wsServer } from "../app.js";
import {
  IdleGamesBody,
  ChangePlayerNameBody,
  Activatef2pgameBody,
  CdkeyRedeemBody,
  ChangePersonaStateBody,
} from "../../@types/controllers/steamAccount.js";
import { SteamAccount } from "../../@types/models/steamAccount.js";

/**
 * Change steam account nickname
 * @Service
 */
export async function idleGames(userId: ObjectId, body: IdleGamesBody) {
  const { steam } = await SteamAccountExistsOnline(userId, body.accountName);
  await steam.client.gamesPlayed(body.gameIds, { forcePlay: body.forcePlay });
  const steamAccount = await SteamAccountModel.updateField(userId, body.accountName, {
    "state.gamesIdsIdle": body.gameIds,
    "state.status": (body.gameIds.length ? "ingame" : "online") as SteamAccount["state"]["status"],
  });
  wsServer.send({
    type: "Success",
    routeName: "steamclient/idlegames",
    userId,
    message: steamAccount,
  });
}

/**
 * Change steam account nickname
 * @Service
 */
export async function changePlayerName(userId: ObjectId, body: ChangePlayerNameBody) {
  const { steam } = await SteamAccountExistsOnline(userId, body.accountName);
  await steam.client.setPlayerName(body.playerName);
  await SteamAccountModel.updateField(userId, body.accountName, { "data.nickname": body.playerName });
  wsServer.send({
    type: "Success",
    routeName: "steamclient/changeplayername",
    userId,
    message: { playerName: body.playerName },
  });
}

/**
 * Activate free to play game.
 * @Service
 */
export async function activatef2pgame(userId: ObjectId, body: Activatef2pgameBody) {
  const { steam, steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const games = await steam.client.requestFreeLicense(body.appids);
  if (!games.length) {
    throw new SteamIdlerError("No games activated. Bad appid(s).");
  }

  const { merge } = mergeGamesArrays(steamAccount.data.games, games);
  await SteamAccountModel.updateField(userId, body.accountName, { "data.games": merge });

  wsServer.send({
    type: "Success",
    routeName: "steamclient/activatef2pgame",
    userId,
    message: { accountName: body.accountName, games },
  });
}

/**
 * Activate free to play game.
 * @Service
 */
export async function cdkeyRedeem(userId: ObjectId, body: CdkeyRedeemBody) {
  const { steam, steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const games = await steam.client.registerKey(body.cdkey);
  const { merge } = mergeGamesArrays(steamAccount.data.games, games);
  await SteamAccountModel.updateField(userId, body.accountName, { "data.games": merge });

  wsServer.send({
    type: "Success",
    routeName: "steamclient/cdkeyredeem",
    userId,
    message: { accountName: body.accountName, games },
  });
}

/**
 * Activate free to play game.
 * @Service
 */
export async function changePersonaState(userId: ObjectId, body: ChangePersonaStateBody) {
  const { steam } = await SteamAccountExistsOnline(userId, body.accountName);
  await steam.client.setPersonaState(body.state);

  // update persona state
  await SteamAccountModel.updateField(userId, body.accountName, {
    "state.personaState": body.state,
  });

  wsServer.send({
    type: "Success",
    routeName: "steamclient/changepersonastate",
    userId,
  });
}
