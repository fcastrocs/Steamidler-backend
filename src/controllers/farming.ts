import { ERRORS, isIntArray, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import * as FarmingService from "../services/farming.js";
import { StartBody } from "../../@types/controllers/farming.js";

/**
 * Start farming
 * @controller
 */
export async function start(userId: ObjectId, body: StartBody) {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName || !isIntArray(body.gameIds) || !body.gameIds) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await FarmingService.start(userId, body);
}

/**
 * Change steam account nickname
 * @controller
 */
export async function stop(userId: ObjectId, body: StartBody) {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await FarmingService.stop(userId, body);
}
