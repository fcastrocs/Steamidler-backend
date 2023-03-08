import { getCollection } from "../db.js";
const collectionName = "users";
import { ObjectId } from "mongodb";
import argon2 from "argon2";

/**
 * Insert or update User
 */
export async function add(user: User): Promise<User> {
  const collection = await getCollection(collectionName);
  user.password = await argon2.hash(user.password);
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

export async function updatePassword(userId: ObjectId, password: string) {
  const collection = await getCollection(collectionName);
  password = await argon2.hash(password);
  await collection.updateOne({ _id: userId }, { $set: { password } }, { upsert: false });
}
