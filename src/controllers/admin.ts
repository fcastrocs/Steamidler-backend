import { ERRORS, SteamIdlerError } from "../commons.js";
import * as ProxyModel from "../models/proxy.js";
import * as SteamServerService from "../services/steamServer.js";
import * as InviteModel from "../models/invite.js";
import Mailer from "../mailer/index.js";
import { SteamClientError } from "@machiavelli/steam-client";

const verifyAdminKey = (adminKey: string) => {
  if (!process.env.API_ADMIN_KEY) throw new SteamIdlerError(ERRORS.UNEXPECTED);
  if (!adminKey) throw new SteamIdlerError(ERRORS.UNEXPECTED);

  if (adminKey !== process.env.API_ADMIN_KEY) {
    throw new SteamIdlerError(ERRORS.UNEXPECTED);
  }
};

/**
 * @controller
 */
export async function addProxies(rawProxies: string, adminKey: string): Promise<number> {
  verifyAdminKey(adminKey);

  if (!rawProxies) {
    throw new SteamClientError("Empty body.");
  }

  const proxies = rawProxies
    .split(/\r?\n/)
    .filter((proxy) => validate(proxy))
    .map((proxy, index) => {
      const split = proxy.split(":");
      const p: Proxy = { name: `Server ${index + 1}`, ip: split[0], port: Number(split[1]), load: 0 };
      return p;
    });

  if (!proxies.length) throw new SteamIdlerError("No proxies passed.");
  return await ProxyModel.add(proxies);
}

/**
 * @controller
 */
export async function fetchSteamServers(adminKey: string): Promise<void> {
  verifyAdminKey(adminKey);
  await SteamServerService.fetchCMs();
}

/**
 * @controller
 */
export async function createInvite(email: string, adminKey: string): Promise<string> {
  verifyAdminKey(adminKey);
  const invite = await InviteModel.add(email);
  const mailer = new Mailer();
  await mailer.sendInvite(email, invite);
  return invite;
}

function validate(proxy: string) {
  const regex = /(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}):(\d{1,5})/;
  return regex.test(proxy);
}
