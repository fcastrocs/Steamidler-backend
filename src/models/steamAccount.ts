import { getClient } from "../db";
import crypto from "crypto";
import { SteamAccount, SteamAccountEncrypted, Encrypted, SteamAccNonSensitive } from "@types";
const collectionName = "steam-accounts";

export async function add(steamAccount: SteamAccount): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  const doc = await get(steamAccount.userId, steamAccount.username);
  if (doc) throw "Account already exists.";
  const encrypedAccount = encryptSteamAccount(steamAccount);
  await collection.insertOne(encrypedAccount);
}

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

export async function get(userId: string, username: string): Promise<SteamAccount> {
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

  const steamaccount: SteamAccount = {
    userId,
    username,
    password: doc.password,
    auth: doc.auth,
    data: doc.data,
    state: doc.state,
  };
  return steamaccount;
}

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

function encryptSteamAccount(steamAccount: SteamAccount): SteamAccountEncrypted {
  const encrypedAccount: SteamAccountEncrypted = {
    userId: steamAccount.userId,
    username: steamAccount.password,
    password: encrypt(steamAccount.password),
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
