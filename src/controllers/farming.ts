import { ERRORS, isIntArray, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import * as FarmingService from "../services/farming.js";
import { StartBody } from "../../@types/controllers/farming.js";

/**
 * @controller
 */
export async function start(userId: ObjectId, body: StartBody) {
  if (!isIntArray(body.gameIds)) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }
  await FarmingService.start(userId, body);
}

/**
 * @controller
 */
export async function stop(userId: ObjectId, body: StartBody) {
  await FarmingService.stop(userId, body);
}
