import { ERRORS, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import { WebSocket } from "ws";
import { ChangeAvatarBody, ChangePrivacyBody, ClearAliasesBody } from "../../@types/controllers/steamweb.js";
import * as SteamWebService from "../services/steamweb.js";

/**
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId: ObjectId, body: ChangeAvatarBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName || !body.avatarDataURL) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamWebService.changeAvatar(userId, body, ws);
}

/**
 * Clear aliases
 * @controller
 */
export async function clearAliases(userId: ObjectId, body: ClearAliasesBody, ws: WebSocket): Promise<void> {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamWebService.clearAliases(userId, body, ws);
}

/**
 * Clear aliases
 * @controller
 */
export async function changePrivacy(userId: ObjectId, body: ChangePrivacyBody, ws: WebSocket) {
  await SteamWebService.changePrivacy(userId, body, ws);
}
