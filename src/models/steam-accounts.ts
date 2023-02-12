import { ObjectId, UpdateFilter } from "mongodb";
import { getCollection } from "../db.js";

import { SteamAccount, SteamAccountEncrypted, SteamAccountNonSensitive } from "../../@types";
import { decrypt, encrypt, ERRORS, SteamIdlerError } from "../commons.js";
const collectionName = "steam-accounts";

/**
 * Add steamAccount to collection
 */
export async function add(steamAccount: SteamAccount): Promise<void> {
  const collection = await getCollection(collectionName);
  const encrypedAccount = encryptSteamAccount(steamAccount);
  await collection.insertOne(encrypedAccount);
}

/**
 * update fields for a single steamAccount with userId and accountName
 * Do not use with account auth. Use 'update' instead
 */
export async function updateField(
  userId: ObjectId,
  accountName: string,
  update: Partial<SteamAccount> | UpdateFilter<SteamAccount>
) {
  if (update.userId || update.accountName) {
    throw new SteamIdlerError(ERRORS.INVALID_UPDATE_FIELDS);
  }

  // need to encrypt auth before updating
  if (update.auth) {
    (update as unknown) = encryptSteamAccount(update as SteamAccount);
  }

  const collection = await getCollection(collectionName);
  await collection.updateOne(
    { userId, accountName },
    {
      $set: update,
    }
  );
}

/**
 * Remove steamAccount with userId and accountName
 */
export async function remove(userId: ObjectId, accountName: string): Promise<SteamAccount> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOneAndDelete({ userId, accountName });
  if (!doc) return null;
  return doc.value as unknown as SteamAccount;
}

/**
 * Return a steamAccount with userId and accountName
 */
export async function get(userId: ObjectId, accountName: string): Promise<SteamAccount> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({
    userId,
    accountName,
  });
  if (!doc) return null;
  return decryptSteamAccount(doc as unknown as SteamAccountEncrypted);
}

export async function getByAccountName(accountName: string): Promise<SteamAccount> {
  const collection = await getCollection(collectionName);
  const doc = await collection.findOne({ accountName });
  if (!doc) return null;
  return decryptSteamAccount(doc as unknown as SteamAccountEncrypted);
}

/**
 * Return all steam accounts without sensitive information
 */
export async function getAll(userId: ObjectId): Promise<SteamAccountNonSensitive[]> {
  const collection = await getCollection(collectionName);
  const cursor = collection.find({ userId }, { projection: { auth: 0, userId: 0 } });
  return (await cursor.toArray()) as unknown as SteamAccountNonSensitive[];
}

/**
 * Helper functions
 */

function encryptSteamAccount(steamAccount: SteamAccount): SteamAccountEncrypted {
  const account: SteamAccountEncrypted = (({ auth, ...others }) => {
    return { ...others, auth: encrypt(JSON.stringify(auth)) };
  })(steamAccount);

  return account;
}

function decryptSteamAccount(steamAccount: SteamAccountEncrypted): SteamAccount {
  const decryptedAuth = JSON.parse(decrypt(steamAccount.auth));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const account: SteamAccount = (({ auth, ...others }) => {
    return { ...others, auth: decryptedAuth };
  })(steamAccount);
  // sentry will be deprecated by steam soon, probably.
  // account.auth.sentry = Buffer.from(decryptedAuth.sentry.data);
  return account;
}
