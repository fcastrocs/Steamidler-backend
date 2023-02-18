import { ERRORS, isIntArray, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import * as actionsService from "../services/steam-account-actions.js";

/**
 * Change steam account nickname
 * @controller
 */
export async function idleGames(userId: ObjectId, body: IdleGamesBody) {
  if (!body.accountName || !body.gameIds || !isIntArray(body.gameIds) || body.gameIds.length > 32) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  isIntArray(body.gameIds);

  if (body.gameIds.length > 32) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }
  await actionsService.idleGames(userId, body);
}

/**
 * Change steam account nickname
 * @controller
 */
export async function changePlayerName(userId: ObjectId, body: ChangePlayerNameBody) {
  if (!body.accountName || !body.playerName || typeof body.playerName !== "string") {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }
  await actionsService.changePlayerName(userId, body);
}

/**
 * Activate free to play game.
 * @controller
 */
export async function activatef2pgame(userId: ObjectId, body: Activatef2pgameBody) {
  if (!body.accountName || !isIntArray(body.appids) || !body.appids) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }
  await actionsService.activatef2pgame(userId, body);
}

/**
 * Activate free to play game.
 * @controller
 */
export async function cdkeyRedeem(userId: ObjectId, body: CdkeyRedeemBody) {
  if (!body.accountName || !body.cdkey || typeof body.cdkey !== "string") {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }
  await actionsService.cdkeyRedeem(userId, body);
}

/**
 * Activate free to play game.
 * @controller
 */
export async function changePersonaState(userId: ObjectId, body: ChangePersonaStateBody) {
  if (!body.accountName || !body.state || typeof body.state !== "string") {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }
  await actionsService.changePersonaState(userId, body);
}
