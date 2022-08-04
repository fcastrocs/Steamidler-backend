/**
 * Holds Steam accounts waiting to be authenticated with a Steam Guard Code
 */
import { SteamVerify } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "steam-verify";

export async function add(steamVerify: SteamVerify): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.insertOne(steamVerify);
}

export async function get(userId: string, username: string): Promise<SteamVerify> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({
    userId,
    username,
  });
  return doc as unknown as SteamVerify;
}

export async function remove(userId: string, username: string): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.deleteOne({ userId, username });
}
