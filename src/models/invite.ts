import { getClient } from "../db.js";

export async function exists(invite: string, email: string): Promise<boolean> {
  const collection = (await getClient()).db().collection("invites");
  const doc = await collection.findOne({ invite, email });
  return !!doc;
}

export async function remove(email: string): Promise<void> {
  const collection = (await getClient()).db().collection("invites");
  await collection.deleteMany({ email });
}
