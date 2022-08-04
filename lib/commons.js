import crypto from "crypto";
import SteamCommunity from "steamcommunity-api";
import * as SteamAccountModel from "./models/steam-accounts.js";
import SteamStore from "./controllers/steam-store.js";
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
    EXISTS: new SteamIdlerError("Exists"),
    ENABLE_STEAM_GUARD: new SteamIdlerError("EnableSteamGuard"),
    LOCKED_ACCOUNT: new SteamIdlerError("LockedAccount"),
    ALREADY_ONLINE: new SteamIdlerError("AlreadyOnline"),
    NOTONLINE: new SteamIdlerError("NotOnline"),
    NOTFOUND: new SteamIdlerError("NotFound"),
    UNEXPECTED: new SteamIdlerError("UnexpectedError"),
    NO_FARMABLE_GAMES: new SteamIdlerError("NoFarmableGames"),
    ALREADY_FARMING: new SteamIdlerError("AlreadyFarming"),
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
        throw ERRORS.NOTFOUND;
    }
    const steam = SteamStore.get(userId, username);
    if (!steam) {
        throw ERRORS.NOTONLINE;
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
