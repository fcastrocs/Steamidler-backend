import crypto from "crypto";
import { Invite } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "invites";

export async function add(email: string): Promise<string> {
  const collection = await getCollection(collectionName);
  const code = crypto.randomBytes(8).toString("hex"); // generates string of length 16
  const invite: Invite = { email, code, createdAt: new Date() };
  await collection.insertOne(invite);
  return code;
}

export async function exits(invite: Omit<Invite, "createdAt">): Promise<boolean> {
  const collection = await getCollection(collectionName);
  if (await collection.findOne(invite)) return true;
  return false;
}

export async function remove(email: string): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.deleteOne({ email });
}
