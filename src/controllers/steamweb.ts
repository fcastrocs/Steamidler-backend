import { ERRORS, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import {
  ChangeAvatarBody,
  ChangePrivacyBody,
  ClearAliasesBody,
  GetFarmableGamesBody,
} from "../../@types/controllers/steamWeb.js";
import * as SteamWebService from "../services/steamWeb.js";

/**
 * Change steam account nickname
 * @controller
 */
export async function changeAvatar(userId: ObjectId, body: ChangeAvatarBody) {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName || !body.avatarDataURL) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamWebService.changeAvatar(userId, body);
}

/**
 * Clear aliases
 * @controller
 */
export async function clearAliases(userId: ObjectId, body: ClearAliasesBody): Promise<void> {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamWebService.clearAliases(userId, body);
}

/**
 * Clear aliases
 * @controller
 */
export async function changePrivacy(userId: ObjectId, body: ChangePrivacyBody) {
  await SteamWebService.changePrivacy(userId, body);
}

/**
 * Clear aliases
 * @controller
 */
export async function getFarmableGames(userId: ObjectId, body: GetFarmableGamesBody) {
  await SteamWebService.getFarmableGames(userId, body);
}
