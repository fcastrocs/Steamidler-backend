import { User } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "users";

/**
 * Insert or update User
 */
export async function upsert(user: User): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.updateOne({ userId: user.userId }, { $set: user }, { upsert: true });
}

export async function get(userId: string): Promise<User> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({ userId });
  return doc as unknown as User;
}

export async function remove(userId: string): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.deleteOne({ userId });
}
