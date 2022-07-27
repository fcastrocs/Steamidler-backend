import { IUser } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "users";

export async function get(userId: string): Promise<IUser | null> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({ userId });
  return (<unknown>doc) as IUser;
}

export async function upsert(userId: string, user: IUser): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.updateOne({ userId }, { $set: user }, { upsert: true });
}
