import { ERRORS, SteamIdlerError } from "../commons.js";
import * as ProxieModel from "../models/proxy.js";
import * as SteamServerModel from "../models/steamServer.js";
import * as InviteModel from "../models/invite.js";

const verifyAdminKey = (adminKey: string) => {
  if (!process.env.API_ADMIN_KEY) throw new SteamIdlerError(ERRORS.UNEXPECTED);
  if (!adminKey) throw new SteamIdlerError(ERRORS.UNEXPECTED);

  if (adminKey !== process.env.API_ADMIN_KEY) {
    throw new SteamIdlerError(ERRORS.UNEXPECTED);
  }
};

/**
 *  Add proxies to database
 * @controller
 */
export async function addProxies(proxies: string, adminKey: string): Promise<number> {
  verifyAdminKey(adminKey);
  const array = proxies.split(/\r?\n/).filter((proxy) => proxy);
  if (!array.length) throw new SteamIdlerError("InvalidBody");
  return await ProxieModel.add(array);
}

/**
 * Fetch and renew Steam servers
 * @controller
 */
export async function renewSteamServers(adminKey: string): Promise<void> {
  verifyAdminKey(adminKey);
  await SteamServerModel.renew();
}

/**
 * create a new invite
 * @controller
 */
export async function createInvite(email: string, adminKey: string): Promise<string> {
  verifyAdminKey(adminKey);
  return await InviteModel.add(email);
}
