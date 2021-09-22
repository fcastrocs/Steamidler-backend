import { getClient } from "../db";
import { Document } from "mongodb";

interface User {
  userId: string;
  name: string;
  token: string;
  email: string;
}

export async function get(userId: string): Promise<Document | null> {
  const collection = getClient().db().collection("users");
  const doc = await collection.findOne({ userId });
  return doc;
}

export async function upsert(userId: string, user: User): Promise<void> {
  const collection = getClient().db().collection("users");
  await collection.updateOne({ userId }, { $set: user }, { upsert: true });
}
