import { SteamCM } from "../../@types";
import fetch from "node-fetch";
import { getCollection } from "../db.js";

const collectionName = "steam-cms";
const STEAMCMS_URL = "https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?format=json&cellid=0";

/**
 * Fetches Steam CMs from the steam api and saves them to 'steam-cms' collection
 */
export async function fetchSteamCms(): Promise<void> {
  const collection = await getCollection(collectionName);

  try {
    const res = await fetch(STEAMCMS_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = await res.json();
    data = data.response.serverlist;

    const documents = [];

    for (const item of data) {
      const split = item.split(":");
      const ip = split[0];
      const port = Number(split[1]);
      const steamcm: SteamCM = { ip, port };
      documents.push(steamcm);
    }

    await collection.deleteMany({});
    await collection.insertMany(documents);
  } catch (error) {
    console.error(error);
    throw "Could not fetch Steam CMs.";
  }
}

/**
 * @returns random SteamCM
 */
export async function getOne(): Promise<SteamCM> {
  const collection = await getCollection(collectionName);
  const cursor = collection.aggregate([{ $sample: { size: 1 } }]);
  const document = await cursor.next();

  if (document == null) throw "Could fetch a Steam CM from db.";

  const steamcm: SteamCM = {
    ip: document.ip,
    port: document.port,
  };

  return steamcm;
}
