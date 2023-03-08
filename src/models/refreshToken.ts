import { ObjectId } from "mongodb";
import { getCollection } from "../db.js";
const collectionName = "refresh-tokens";

/**
 * Insert or update User
 */
export async function upsert(refreshToken: RefreshToken) {
  const collection = await getCollection(collectionName);
  await collection.updateOne({ userId: refreshToken.userId }, { $set: refreshToken }, { upsert: true });
}

/**
 * Remove refresh token
 * Only use it when user is authenticated
 */
export async function remove(userId: ObjectId) {
  const collection = await getCollection(collectionName);
  const res = await collection.deleteOne({ userId });
  return !!res.deletedCount;
}

/**
 * Verify user has valid token and can reauthenticate
 */
export async function has(refreshToken: RefreshToken) {
  const collection = await getCollection(collectionName);
  const res = await collection.findOne(refreshToken);
  return !!res;
}
