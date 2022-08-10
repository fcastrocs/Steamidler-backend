import crypto from "crypto";
import SteamCommunity from "steamcommunity-api";
import * as SteamAccountModel from "./models/steam-accounts.js";
import SteamStore from "./models/steam-store.js";
import { EventEmitter } from "events";
const eventEmitter = new EventEmitter();
export { eventEmitter };
export class SteamIdlerError extends Error {
    constructor(message) {
        super(message);
        super.name = "steamidler";
    }
}
const SteamGuardError = ["AccountLogonDenied", "AccountLoginDeniedNeedTwoFactor"];
const BadSteamGuardCode = ["InvalidLoginAuthCode", "TwoFactorCodeMismatch"];
const BadPassword = ["InvalidPassword"];
export const isSteamGuardError = (error) => SteamGuardError.includes(error);
export const isBadSteamGuardCode = (error) => BadSteamGuardCode.includes(error);
export const isBadPassword = (error) => BadPassword.includes(error);
export const isAuthError = (error) => isSteamGuardError(error) || isBadSteamGuardCode(error) || isBadPassword(error);
export const ERRORS = {
    EXISTS: "Exists",
    ENABLE_STEAM_GUARD: "EnableSteamGuard",
    LOCKED_ACCOUNT: "LockedAccount",
    ALREADY_ONLINE: "AlreadyOnline",
    NOTONLINE: "NotOnline",
    NOTFOUND: "NotFound",
    UNEXPECTED: "UnexpectedError",
    NO_FARMABLE_GAMES: "NoFarmableGames",
    ALREADY_FARMING: "AlreadyFarming",
    PROXY_LIMIT_REACHED: "ProxyLimitReached",
    PROXY_NOT_VALID: "ProxyNotValid",
    INVALID_UPDATE_FIELDS: "InvalidUpdateFields",
    BAD_PASSWORD_EMAIL: "BadPasswordOrEmail",
};
export function getAgentOptions(proxy) {
    return {
        hostname: proxy.ip,
        port: proxy.port,
        type: Number(process.env.PROXY_TYPE),
        userId: process.env.PROXY_USER,
        password: process.env.PROXY_PASS,
    };
}
export async function SteamAccountExistsOnline(userId, username) {
    const steamAccount = await SteamAccountModel.get(userId, username);
    if (!steamAccount) {
        throw new SteamIdlerError(ERRORS.NOTFOUND);
    }
    const steam = SteamStore.get(userId, username);
    if (!steam) {
        throw new SteamIdlerError(ERRORS.NOTONLINE);
    }
    return { steamAccount, steam };
}
export function getSteamCommunity(steamAccount) {
    return new SteamCommunity({
        agentOptions: getAgentOptions(steamAccount.state.proxy),
        webNonce: steamAccount.auth.webNonce,
        steamid: steamAccount.data.steamId,
        cookie: steamAccount.auth.cookie,
    });
}
export function encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(process.env.ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(data, "utf-8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
}
export function decrypt(data) {
    const dataParts = data.split(":");
    const iv = Buffer.from(dataParts[0], "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(process.env.ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(dataParts[1], "hex", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
}
/**
 * merge two games arrays and return the merged and the difference arrays
 */
export function mergeGamesArrays(array1, array2) {
    const difference = [];
    const merge = array1.concat(array2.filter((item) => {
        const duplicate = array1.some((game) => game.gameid === item.gameid);
        if (!duplicate)
            difference.push(item);
        // return false for duplicates
        return !duplicate;
    }));
    return { merge, difference };
}
