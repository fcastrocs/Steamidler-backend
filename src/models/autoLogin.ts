import { Document } from "mongodb";
import { getClient } from "../db";
const collectionName = "auto-login";

export async function add(userId: string, username: string): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  if (await exists(userId, username)) {
    throw Error(`auto-login for ${username} already exits.`);
  }
  await collection.insertOne({ userId, username });
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

async function exists(userId: string, username: string): Promise<boolean> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await collection.findOne({
    userId,
    username,
  });
  return !!doc;
}

export async function remove(userId: string, username: string): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  await collection.deleteOne({ userId, username });
}
