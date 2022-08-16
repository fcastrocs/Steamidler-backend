import { RefreshToken } from "../../@types/index.js";
import { getCollection } from "../db.js";
const collectionName = "refresh-tokens";

/**
 * Insert or update User
 */
export async function add(refreshToken: RefreshToken) {
  const collection = await getCollection(collectionName);
  await collection.insertOne(refreshToken);
}

export async function remove(refreshToken: RefreshToken) {
  const collection = await getCollection(collectionName);
  const res = await collection.deleteOne(refreshToken);
  return !!res.deletedCount;
}

export async function has(refreshToken: RefreshToken) {
  const collection = await getCollection(collectionName);
  const res = await collection.findOne(refreshToken);
  return !!res;
}
