import { User } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "users";
import { ObjectId } from "mongodb";

/**
 * Insert or update User
 */
export async function add(user: User): Promise<User> {
  const collection = await getCollection(collectionName);
  await collection.insertOne(user);
  return user;
}

export async function get(options: { email?: string; _id?: ObjectId }): Promise<User> {
  const collection = await getCollection(collectionName);
  const filter = options.email ? { email: options.email } : { _id: options._id };
  const doc = await collection.findOne(filter);
  return doc as User;
}

export async function remove(email: string): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const res = await collection.deleteOne({ email });
  return !!res.deletedCount;
}
