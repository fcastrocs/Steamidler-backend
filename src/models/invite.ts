import crypto from "crypto";
import { Invite } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "invites";

export async function add(email: string): Promise<string> {
  // santize email
  email = email.toLowerCase();

  const collection = await getCollection(collectionName);
  const code = crypto.randomBytes(32).toString("hex");
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
