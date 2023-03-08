import { getCollection } from "../db.js";
const collectionName = "pass-reset-tokens";
import { ObjectId } from "mongodb";
import crypto from "crypto";

/**
 * Insert or update User
 */
export async function add(userId: ObjectId, email: string): Promise<string> {
  const collection = await getCollection(collectionName);
  const token = crypto.randomBytes(16).toString("hex");
  await collection.replaceOne({ userId, email }, { userId, email, token, createdAt: new Date() }, { upsert: true });
  return token;
}

export async function get(filter: { email?: string; userId?: ObjectId }): Promise<string> {
  const collection = await getCollection(collectionName);
  const doc = (await collection.findOne(filter)) as unknown as PassResetToken;
  return doc.token;
}

export async function remove(userId: ObjectId): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const res = await collection.deleteOne({ _id: userId });
  return !!res.deletedCount;
}
