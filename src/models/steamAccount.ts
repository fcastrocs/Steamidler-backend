import { getClient } from "../db.js";
import crypto from "crypto";
import { SteamAccount, SteamAccountEncrypted, Encrypted, SteamAccNonSensitive } from "@types";
import { UpdateFilter, Document } from "mongodb";
const collectionName = "steam-accounts";

/**
 * Add steamAccount to collection
 */
export async function add(steamAccount: SteamAccount): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await get(steamAccount.userId, steamAccount.username);
  if (doc) throw "Account already exists.";
  const encrypedAccount = encryptSteamAccount(steamAccount);
  await collection.insertOne(encrypedAccount);
}

/**
 * update steamAccount
 */
export async function update(steamAccount: SteamAccount): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  const encrypedAccount = encryptSteamAccount(steamAccount);
  await collection.updateOne(
    { userId: steamAccount.userId, username: steamAccount.username },
    {
      $set: encrypedAccount,
    }
  );
}

/**
 * update fields for a single steamAccount with userId and username
 */
export async function updateField(
  userId: string,
  username: string,
  update: UpdateFilter<Document> | Partial<Document>
): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  await collection.updateOne(
    { userId, username },
    {
      $set: update,
    }
  );
}

/**
 * Remove steamAccount with userId and username
 */
export async function remove(userId: string, username: string): Promise<SteamAccount> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await collection.findOneAndDelete({ userId, username });
  if (!doc) return null;
  return doc.value as SteamAccount;
}

/**
 * Check whether a steamAccount with userId and username exists in collection
 */
export async function exists(userId: string, username: string): Promise<boolean> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await collection.findOne({
    userId,
    username,
  });
  return !!doc;
}

/**
 * Return a steamAccount with userId and username
 */
export async function get(userId: string, username: string): Promise<SteamAccount> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await collection.findOne({
    userId,
    username,
  });
  if (!doc) return null;
  // decrypt auth
  doc.auth = JSON.parse(decrypt(doc.auth));
  // convert string sentry to buffer
  doc.auth.sentry = Buffer.from(doc.auth.sentry as string, "hex");
  return doc as SteamAccount;
}

/**
 * Return all steam accounts without sensitive information that match userId
 */
export async function getAll(userId: string): Promise<SteamAccNonSensitive[]> {
  const collection = (await getClient()).db().collection(collectionName);
  const cursor = collection.find({ userId });
  const documents = await cursor.toArray();

  const steamAccounts: SteamAccNonSensitive[] = [];

  for (const doc of documents) {
    const steamAccount: SteamAccNonSensitive = {
      username: doc.username,
      data: doc.data,
      state: doc.state,
    };
    steamAccounts.push(steamAccount);
  }
  return steamAccounts;
}

/**
 * Helper functions
 */

function encryptSteamAccount(steamAccount: SteamAccount): SteamAccountEncrypted {
  // convert sentry buffer to string
  steamAccount.auth.sentry = (steamAccount.auth.sentry as Buffer).toString("hex");
  const encrypedAccount: SteamAccountEncrypted = {
    userId: steamAccount.userId,
    username: steamAccount.username,
    auth: encrypt(JSON.stringify(steamAccount.auth)),
    data: steamAccount.data,
    state: steamAccount.state,
  };
  return encrypedAccount;
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
