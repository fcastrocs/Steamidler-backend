import { User } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "users";

/**
 * Insert or update User
 */
export async function add(user: User): Promise<User> {
  const collection = await getCollection(collectionName);
  await collection.insertOne(user);
  return user;
}

export async function get(email: string): Promise<User> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({ email });
  return doc as User;
}

export async function remove(email: string): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const res = await collection.deleteOne({ email });
  return !!res.deletedCount;
}
