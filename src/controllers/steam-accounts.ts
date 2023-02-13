import * as SteamAccountService from "../services/steam-account.js";

import { ERRORS, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import {
  AddAccountBody,
  GetBody,
  LoginBody,
  RemoveBody,
  UpdateWithSteamGuardCodeBody,
} from "../../@types/addSteamAccount";

/**
 * Add new account
 * @controller
 */
export async function add(userId: ObjectId, body: AddAccountBody) {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.authType) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  if (body.authType !== "QRcode" && body.authType !== "SteamGuardCode") {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  if (body.authType === "SteamGuardCode" && !body.accountName && !body.password) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  // lowercase accountName
  if (body.accountName) body.accountName = body.accountName.toLocaleLowerCase();

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
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.login(userId, body);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function logout(userId: ObjectId, body: LoginBody) {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.logout(userId, body);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function authRenew(userId: ObjectId, body: AddAccountBody) {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.authType) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  if (body.authType !== "QRcode" && body.authType !== "SteamGuardCode") {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  if (body.authType === "SteamGuardCode" && !body.accountName && !body.password) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  // lowercase accountName
  if (body.accountName) body.accountName = body.accountName.toLocaleLowerCase();

  await SteamAccountService.authRenew(userId, body);
}

/**
 * Remove a Steam account
 * @controller
 */
export async function remove(userId: ObjectId, body: RemoveBody) {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.remove(userId, body);
}

/**
 * Get a Steam account
 * @controller
 */
export async function get(userId: ObjectId, body: GetBody) {
  if (!userId || !body) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.get(userId, body);
}

/**
 * Remove a Steam account
 * @controller
 */
export async function getAll(userId: ObjectId, body: any) {
  if (!userId) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  await SteamAccountService.getAll(userId);
}
