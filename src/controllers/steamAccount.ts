import * as SteamAccountService from "../services/steamAccount.js";

import { ERRORS, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import {
  AddAccountBody,
  CancelConfirmationBody,
  GetBody,
  LoginBody,
  RemoveBody,
  UpdateWithSteamGuardCodeBody,
} from "../../@types/controllers/steamAccount.js";

/**
 * Add new account
 * @controller
 */
export async function add(userId: ObjectId, body: AddAccountBody) {
  // normalize
  body.accountName = body.accountName.toLocaleLowerCase();
  await SteamAccountService.add(userId, body);
}

export async function updateWithSteamGuardCode(userId: ObjectId, body: UpdateWithSteamGuardCodeBody) {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.code || !body.guardType) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.updateWithSteamGuardCode(userId, body);
}

/**
 * login a Steam account
 * @controller
 */
export async function login(userId: ObjectId, body: LoginBody) {
  body.accountName = body.accountName.toLocaleLowerCase();
  await SteamAccountService.login(userId, body);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function logout(userId: ObjectId, body: LoginBody) {
  body.accountName = body.accountName.toLocaleLowerCase();
  await SteamAccountService.logout(userId, body);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function authRenew(userId: ObjectId, body: AddAccountBody) {
  if (body.authType === "SteamGuardCode" && !body.accountName && !body.password) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  body.accountName = body.accountName.toLocaleLowerCase();
  await SteamAccountService.authRenew(userId, body);
}

/**
 * Remove a Steam account
 * @controller
 */
export async function remove(userId: ObjectId, body: RemoveBody) {
  body.accountName = body.accountName.toLocaleLowerCase();
  await SteamAccountService.remove(userId, body);
}

/**
 * Get a Steam account
 * @controller
 */
export async function get(userId: ObjectId, body: GetBody) {
  await SteamAccountService.get(userId, body);
}

/**
 * Remove a Steam account
 * @controller
 */
export async function getAll(userId: ObjectId, body: any) {
  await SteamAccountService.getAll(userId);
}

/**
 * cancel confirmation
 * @controller
 */
export async function cancelConfirmation(userId: ObjectId, body: CancelConfirmationBody) {
  body.accountName = body.accountName.toLocaleLowerCase();
  await SteamAccountService.cancelConfirmation(userId, body);
}
