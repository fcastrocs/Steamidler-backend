import * as SteamAccountService from "../services/steam-account.js";
import { ERRORS, SteamIdlerError } from "../commons.js";
/**
 * Add new account
 * @controller
 */
export async function add(userId, body, ws) {
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
    if (body.accountName)
        body.accountName = body.accountName.toLocaleLowerCase();
    await SteamAccountService.add(userId, body, ws);
}
export async function updateWithSteamGuardCode(userId, body, ws) {
    if (!userId || !body || !ws) {
        throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
    }
    if (!body.code) {
        throw new SteamIdlerError(ERRORS.INVALID_BODY);
    }
    await SteamAccountService.updateWithSteamGuardCode(userId, body, ws);
}
/**
 * login a Steam account
 * @controller
 */
export async function login(userId, body, ws) {
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
export async function logout(userId, body, ws) {
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
export async function authRenew(userId, body, ws) {
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
    if (body.accountName)
        body.accountName = body.accountName.toLocaleLowerCase();
    await SteamAccountService.authRenew(userId, body, ws);
}
/**
 * Remove a Steam account
 * @controller
 */
export async function remove(userId, body, ws) {
    if (!userId || !body || !ws) {
        throw new SteamIdlerError(ERRORS.BAD_PARAMETERS);
    }
    if (!body.accountName) {
        throw new SteamIdlerError(ERRORS.INVALID_BODY);
    }
    await SteamAccountService.remove(userId, body, ws);
}
