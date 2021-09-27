import { SteamVerify } from "@types";
import { Document } from "mongodb";
import { getClient } from "../db";
const collectionName = "steam-verify";

export async function add(steamVerify: SteamVerify): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  if (await exists(steamVerify.userId, steamVerify.username)) {
    throw `Steam-verify for ${steamVerify.username} already exits.`;
  }
  await collection.insertOne(steamVerify);
}

export async function remove(userId: string, username: string): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  await collection.deleteOne({ userId, username });
}

export async function exists(userId: string, username: string): Promise<boolean> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await collection.findOne({
    userId,
    username,
  });
  return !!doc;
}

export async function get(userId: string, username: string): Promise<Document> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await collection.findOne({
    userId,
    username,
  });
  if (!doc) return null;
  return doc;
}
