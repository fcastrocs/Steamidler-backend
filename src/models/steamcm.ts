import { SteamCM } from "@types";
import axios from "axios";
import { getClient } from "../db";
const collectionName = "steam-cms";

/**
 * Fetches Steam CMs from the steam api and saves them to 'steam-cms' collection
 */
export async function fetchSteamCms(): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);

  try {
    const res = await axios.get(process.env.STEAMCMS_URL);

    const documents = [];

    for (const item of res.data.response.serverlist) {
      const split = item.split(":");
      const ip = split[0];
      const port = Number(split[1]);
      const steamcm: SteamCM = { ip, port };
      documents.push(steamcm);
    }

    await collection.deleteMany({});
    await collection.insertMany(documents);
  } catch (error) {
    Promise.reject("Could not fetch Steam CMs.");
    console.error(error);
  }
}

/**
 * @returns random SteamCM
 */
export async function getOne(): Promise<SteamCM> {
  const collection = (await getClient()).db().collection(collectionName);
  const cursor = collection.aggregate([{ $sample: { size: 1 } }]);
  const document = await cursor.next();

  if (document == null) throw "Could fetch a Steam CM from db.";

  const steamcm: SteamCM = {
    ip: document.ip,
    port: document.port,
  };

  return steamcm;
}
