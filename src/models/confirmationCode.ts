import { getCollection } from "../db.js";
const collectionName = "confirmation-codes";
import { ObjectId } from "mongodb";
import crypto from "crypto";

export async function add(userId: ObjectId): Promise<string> {
  const collection = await getCollection(collectionName);
  const code = crypto.randomBytes(3).toString("hex");
  await collection.replaceOne({ userId }, { userId, code, createdAt: new Date() }, { upsert: true });
  return code;
}

export async function get(userId: ObjectId): Promise<string> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({ userId });
  return doc.code;
}

export async function remove(userId: ObjectId): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const res = await collection.deleteOne({ userId });
  return !!res.deletedCount;
}
