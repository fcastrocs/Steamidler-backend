import { ERRORS, isIntArray, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import * as steamClientService from "../services/steamClient.js";
import {
  Activatef2pgameBody,
  CdkeyRedeemBody,
  ChangePersonaStateBody,
  ChangePlayerNameBody,
  IdleGamesBody,
} from "../../@types/controllers/steamAccount.js";

/**
 * @controller
 */
export async function idleGames(userId: ObjectId, body: IdleGamesBody) {
  if (!isIntArray(body.gameIds) || body.gameIds.length > 32) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await steamClientService.idleGames(userId, body);
}

/**
 * @controller
 */
export async function changePlayerName(userId: ObjectId, body: ChangePlayerNameBody) {
  if (!body.playerName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await steamClientService.changePlayerName(userId, body);
}

/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId: ObjectId, body: Activatef2pgameBody) {
  if (!isIntArray(body.appids) || body.appids.length > 10) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }
  await steamClientService.activatef2pgame(userId, body);
}

/**
 * Activate free to play game.
 * @controller
 */
export async function cdkeyRedeem(userId: ObjectId, body: CdkeyRedeemBody) {
  if (!body.cdkey) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }
  await steamClientService.cdkeyRedeem(userId, body);
}

/**
 * Activate free to play game.
 * @controller
 */
export async function changePersonaState(userId: ObjectId, body: ChangePersonaStateBody) {
  await steamClientService.changePersonaState(userId, body);
}
