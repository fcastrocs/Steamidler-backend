import { ERRORS, SteamIdlerError } from "../commons.js";
import * as ProxiesModel from "../models/proxies.js";
import * as SteamServersModel from "../models/steam-servers.js";
import * as InvitesModel from "../models/invites.js";
const verifyAdminKey = (adminKey) => {
    if (!process.env.API_ADMIN_KEY)
        throw new SteamIdlerError(ERRORS.UNEXPECTED);
    if (!adminKey)
        throw new SteamIdlerError(ERRORS.UNEXPECTED);
    if (adminKey !== process.env.API_ADMIN_KEY) {
        throw new SteamIdlerError(ERRORS.UNEXPECTED);
    }
};
/**
 *  Add proxies to database
 * @controller
 */
export async function addProxies(proxies, adminKey) {
    verifyAdminKey(adminKey);
    const array = proxies.split(/\r?\n/).filter((proxy) => proxy);
    if (!array.length)
        throw new SteamIdlerError("InvalidBody");
    return await ProxiesModel.add(array);
}
/**
 * Fetch and renew Steam servers
 * @controller
 */
export async function renewSteamServers(adminKey) {
    verifyAdminKey(adminKey);
    await SteamServersModel.renew();
}
/**
 * create a new invite
 * @controller
 */
export async function createInvite(email, adminKey) {
    verifyAdminKey(adminKey);
    return await InvitesModel.add(email);
}
