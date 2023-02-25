import * as SteamAccountModel from "../models/steamAccount.js";
import { mergeGamesArrays, SteamAccountExistsOnline } from "../commons.js";
import { ObjectId } from "mongodb";
import { wsServer } from "../app.js";
import {
  IdleGamesBody,
  ChangePlayerNameBody,
  Activatef2pgameBody,
  CdkeyRedeemBody,
  ChangePersonaStateBody,
} from "../../@types/controllers/steamAccount.js";

/**
 * Change steam account nickname
 * @Service
 */
export async function idleGames(userId: ObjectId, body: IdleGamesBody) {
  const { steam } = await SteamAccountExistsOnline(userId, body.accountName);
  await steam.client.gamesPlayed(body.gameIds, { forcePlay: body.forcePlay });
  const steamAccount = await SteamAccountModel.updateField(userId, body.accountName, {
    "state.gamesIdsIdle": body.gameIds,
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
  steam.client.setPlayerName(body.playerName);
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
  const { difference, merge } = mergeGamesArrays(steamAccount.data.games, games);
  await SteamAccountModel.updateField(userId, body.accountName, { "data.games": merge });
  wsServer.send({
    type: "Success",
    routeName: "steamclient/activatef2pgame",
    userId,
    message: { gamesActivated: difference },
  });
}

/**
 * Activate free to play game.
 * @Service
 */
export async function cdkeyRedeem(userId: ObjectId, body: CdkeyRedeemBody) {
  const { steam, steamAccount } = await SteamAccountExistsOnline(userId, body.accountName);
  const games = await steam.client.registerKey(body.cdkey);
  const { difference, merge } = mergeGamesArrays(steamAccount.data.games, games);
  await SteamAccountModel.updateField(userId, body.accountName, { "data.games": merge });
  wsServer.send({
    type: "Success",
    routeName: "steamclient/cdkeyredeem",
    userId,
    message: { gamesRedeemed: difference },
  });
}

/**
 * Activate free to play game.
 * @Service
 */
export async function changePersonaState(userId: ObjectId, body: ChangePersonaStateBody) {
  const { steam } = await SteamAccountExistsOnline(userId, body.accountName);
  steam.client.setPersonaState("Offline");
  wsServer.send({
    type: "Success",
    routeName: "steamclient/changepersonastate",
    userId,
  });
}
