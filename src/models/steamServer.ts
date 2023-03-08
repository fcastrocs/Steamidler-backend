import fetch from "node-fetch";
import { getCollection } from "../db.js";
import { SteamIdlerError } from "../commons.js";

const collectionName = "steam-servers";
const STEAMCMS_URL = "https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?format=json&cellid=0";

/**
 * Fetches Steam CMs from the steam api and saves them to 'steam-cms' collection
 */
export async function renew(): Promise<void> {
  const collection = await getCollection(collectionName);
  const data = (await fetch(STEAMCMS_URL).then((res) => res.json())) as GetCMListResponse;

  // Fetch Steam CM servers
  const SteamCMList: SteamCM[] = data.response.serverlist.map((server) => {
    const split = server.split(":");
    return { ip: split[0], port: Number(split[1]) };
  });

  // Fetch CM location info and get only US/Ashburn servers
  const SteamCMInfo = await fetch("http://ip-api.com/batch", {
    method: "POST",
    body: JSON.stringify(
      SteamCMList.map((cm) => {
        return cm.ip;
      })
    ),
  }).then(async (res) => {
    const cmInfo = (await res.json()) as any[];
    return cmInfo.filter((cm) => {
      return cm.countryCode === "US" && cm.city === "Ashburn";
    });
  });

  // Remap to ip and proxy
  const filteredSteamCMList = SteamCMList.filter((cm) => {
    return SteamCMInfo.filter((info) => info.query === cm.ip).length > 0;
  });

  if (!filteredSteamCMList.length) {
    throw new SteamIdlerError("Could not get US/Ashburn Steam CM servers.");
  }

  await collection.deleteMany({});
  await collection.insertMany(filteredSteamCMList);
}

/**
 * @returns random SteamCM
 */
export async function getOne(): Promise<SteamCM> {
  const collection = await getCollection(collectionName);
  const cursor = collection.aggregate([{ $sample: { size: 1 } }]);
  const server = await cursor.next();
  if (!server) throw new SteamIdlerError("Steam CM list is empty.");
  return server as SteamCM;
}
