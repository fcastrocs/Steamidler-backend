import { ERRORS } from "../commons.js";
import crypto from "crypto";
import { Invite } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "invites";

export async function createInvite(email: string): Promise<string> {
  const collection = await getCollection(collectionName);
  if (await collection.findOne({ email })) throw ERRORS.EXISTS;

  const code = crypto.randomBytes(8).toString("hex"); // generates string of length 16
  const invite: Invite = { email, code, createdAt: new Date() };
  await collection.insertOne(invite);
  return code;
}

export async function inviteExists(email: string, code: string): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const invite = (await collection.findOne({ email })) as unknown as Invite;
  if (!invite) return false;
  return invite.code === code;
}

export async function removeInvite(email: string): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.deleteOne({ email });
}
