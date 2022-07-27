import { getCollection } from "../db.js";
const collectionName = "invites";

export async function exists(invite: string, email: string): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({ invite, email });
  return !!doc;
}

export async function remove(email: string): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.deleteMany({ email });
}
