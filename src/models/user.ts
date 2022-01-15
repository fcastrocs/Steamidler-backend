import { IUser } from "@types";
import { getClient } from "../db.js";

export async function get(userId: string): Promise<IUser | null> {
  const collection = (await getClient()).db().collection("users");
  const doc = await collection.findOne({ userId });
  return (<unknown>doc) as IUser;
}

export async function upsert(userId: string, user: IUser): Promise<void> {
  const collection = (await getClient()).db().collection("users");
  await collection.updateOne({ userId }, { $set: user }, { upsert: true });
}
