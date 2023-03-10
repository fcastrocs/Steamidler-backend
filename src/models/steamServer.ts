import fetch from "node-fetch";
import { getCollection } from "../db.js";
import { SteamIdlerError } from "../commons.js";
import { SteamCM } from "../../@types/models/steamServer.js";

const collectionName = "steam-servers";

export async function add(list: SteamCM[]) {
  const collection = await getCollection(collectionName);
  await collection.deleteMany({});
  await collection.insertMany(list);
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
