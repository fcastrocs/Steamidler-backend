export const ERRORS = {
    EXISTS: "Exists",
    ENABLE_STEAM_GUARD: "EnableSteamGuard",
    LOCKED_ACCOUNT: "LockedAccount",
    ALREADY_ONLINE: "AlreadyOnline",
    NOTONLINE: "NotOnline",
    NOTFOUND: "NotFound",
    UNEXPECTED: "UnexpectedError",
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
/**
 * Normalizes error so that only string errors are thrown
 */
export function normalizeLoginErrors(error) {
    if (typeof error !== "string") {
        console.error(error);
        return ERRORS.UNEXPECTED;
    }
    return error;
}
