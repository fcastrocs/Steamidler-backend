/**
 * Holds Steam accounts waiting to be authenticated with a Steam Guard Code
 */
import { ObjectId } from "mongodb";
import { SteamVerify } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "steam-verifications";

export async function add(steamVerify: SteamVerify): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.insertOne(steamVerify);
}

export async function get(userId: ObjectId): Promise<SteamVerify> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({ userId });
  return doc as unknown as SteamVerify;
}

export async function remove(userId: ObjectId): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const res = await collection.deleteOne({ userId });
  return !!res.deletedCount;
}
