import * as SteamAccountService from "../services/steam-account.js";

import { ERRORS, SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import { WebSocket } from "ws";
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
export async function add(userId: ObjectId, body: AddAccountBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
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

  await SteamAccountService.add(userId, body, ws);
}

export async function updateWithSteamGuardCode(userId: ObjectId, body: UpdateWithSteamGuardCodeBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.code || !body.guardType) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.updateWithSteamGuardCode(body, ws);
}

/**
 * login a Steam account
 * @controller
 */
export async function login(userId: ObjectId, body: LoginBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.login(userId, body, ws);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function logout(userId: ObjectId, body: LoginBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.logout(userId, body, ws);
}

/**
 * Logout a Steam account
 * @controller
 */
export async function authRenew(userId: ObjectId, body: AddAccountBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
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

  await SteamAccountService.authRenew(userId, body, ws);
}

/**
 * Remove a Steam account
 * @controller
 */
export async function remove(userId: ObjectId, body: RemoveBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.remove(userId, body, ws);
}

/**
 * Get a Steam account
 * @controller
 */
export async function get(userId: ObjectId, body: GetBody, ws: WebSocket) {
  if (!userId || !body || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  if (!body.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_BODY);
  }

  await SteamAccountService.get(userId, body, ws);
}

/**
 * Remove a Steam account
 * @controller
 */
export async function getAll(userId: ObjectId, body: any, ws: WebSocket) {
  if (!userId || !ws) {
    throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
  }

  await SteamAccountService.getAll(userId, ws);
}
