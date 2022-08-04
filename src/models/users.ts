import { User } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "users";

export async function get(userId: string): Promise<User> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({ userId });
  return doc as unknown as User;
}

export async function upsert(userId: string, user: User): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.updateOne({ userId }, { $set: user }, { upsert: true });
}
