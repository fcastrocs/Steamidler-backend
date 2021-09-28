import { Document } from "mongodb";
import { getClient } from "../db";
import crypto from "crypto";
import { SteamAccount, Encrypted } from "@types";
const collectionName = "steam-accounts";

export async function add(steamAccount: SteamAccount): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await get(steamAccount.userId, steamAccount.username);
  if (doc) throw "Account already exists.";

  // encrypt sensitive data
  const password = `${steamAccount.password}`;
  steamAccount.password = encrypt(password);
  const authString = JSON.stringify(steamAccount.auth);
  steamAccount.auth = encrypt(authString);
  await collection.insertOne(steamAccount);
}

export async function remove(userId: string, username: string): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  await collection.deleteOne({ userId, username });
}

export async function exists(userId: string, username: string): Promise<boolean> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await collection.findOne({
    userId,
    username,
  });
  return !!doc;
}

export async function get(userId: string, username: string): Promise<Document> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await collection.findOne({
    userId,
    username,
  });
  if (!doc) return null;
  // decrypt password
  doc.password = decrypt(doc.password);
  // decrypt auth
  doc.auth = JSON.parse(decrypt(doc.auth));
  return doc;
}

function encrypt(text: string): Encrypted {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(process.env.ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString("hex"), data: encrypted.toString("hex") };
}

function decrypt(text: { iv: string; data: string }): string {
  const iv = Buffer.from(text.iv, "hex");
  const encryptedText = Buffer.from(text.data, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(process.env.ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
