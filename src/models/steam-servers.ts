import { GetCMListResponse, SteamCM } from "../../@types";
import fetch from "node-fetch";
import { getCollection } from "../db.js";
import { SteamIdlerError } from "../commons.js";

const collectionName = "steam-cms";
const STEAMCMS_URL = "https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?format=json&cellid=0";

/**
 * Fetches Steam CMs from the steam api and saves them to 'steam-cms' collection
 */
export async function fetchSteamServers(): Promise<void> {
  const collection = await getCollection(collectionName);
  const res = await fetch(STEAMCMS_URL);
  const data = (await res.json()) as GetCMListResponse;

  const serverList: SteamCM[] = data.response.serverlist.map((server) => {
    const split = server.split(":");
    const steamcm: SteamCM = { ip: split[0], port: Number(split[1]) };
    return steamcm;
  });

  await collection.deleteMany({});
  await collection.insertMany(serverList);
}

/**
 * @returns random SteamCM
 */
export async function getOne(): Promise<SteamCM> {
  const collection = await getCollection(collectionName);
  const cursor = collection.aggregate([{ $sample: { size: 1 } }]);
  const server = await cursor.next();
  if (!server) throw new SteamIdlerError("EmptySteamCMList");
  return server as SteamCM;
}
