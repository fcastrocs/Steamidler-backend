import { ObjectId } from "mongodb";
import {
  ChangeAvatarBody,
  ChangePrivacyBody,
  ClearAliasesBody,
  GetAvatarFrameBody,
  GetFarmableGamesBody,
} from "../../@types/controllers/steamWeb.js";
import * as SteamWebService from "../services/steamWeb.js";

/**
 * @controller
 */
export async function changeAvatar(userId: ObjectId, body: ChangeAvatarBody) {
  await SteamWebService.changeAvatar(userId, body);
}

/**
 * @controller
 */
export async function clearAliases(userId: ObjectId, body: ClearAliasesBody) {
  await SteamWebService.clearAliases(userId, body);
}

/**
 * @controller
 */
export async function changePrivacy(userId: ObjectId, body: ChangePrivacyBody) {
  await SteamWebService.changePrivacy(userId, body);
}

/**
 * @controller
 */
export async function getFarmableGames(userId: ObjectId, body: GetFarmableGamesBody) {
  await SteamWebService.getFarmableGames(userId, body);
}

/**
 * @controller
 */
export async function getAvatarFrame(userId: ObjectId, body: GetAvatarFrameBody) {
  await SteamWebService.getAvatarFrame(userId, body);
}
