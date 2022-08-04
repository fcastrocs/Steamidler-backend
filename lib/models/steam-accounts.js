import { getCollection } from "../db.js";
import { decrypt, encrypt, ERRORS } from "../commons.js";
const collectionName = "steam-accounts";
/**
 * Add steamAccount to collection
 */
export async function add(steamAccount) {
    const collection = await getCollection(collectionName);
    const doc = await get(steamAccount.userId, steamAccount.username);
    if (doc)
        throw ERRORS.EXISTS;
    const encrypedAccount = encryptSteamAccount(steamAccount);
    await collection.insertOne(encrypedAccount);
}
/**
 * update steamAccount
 */
export async function update(steamAccount) {
    const collection = await getCollection(collectionName);
    const encryptedAccount = encryptSteamAccount(steamAccount);
    await collection.updateOne({ userId: steamAccount.userId, username: steamAccount.username }, {
        $set: encryptedAccount,
    });
}
/**
 * update fields for a single steamAccount with userId and username
 * Do not use with account auth. Use 'update' instead
 */
export async function updateField(userId, username, update) {
    const collection = await getCollection(collectionName);
    await collection.updateOne({ userId, username }, {
        $set: update,
    });
}
/**
 * Remove steamAccount with userId and username
 */
export async function remove(userId, username) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOneAndDelete({ userId, username });
    if (!doc)
        return null;
    return doc.value;
}
/**
 * Check whether a steamAccount with userId and username exists in collection
 */
export async function exists(userId, username) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOne({
        userId,
        username,
    });
    return !!doc;
}
/**
 * Return a steamAccount with userId and username
 */
export async function get(userId, username) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOne({
        userId,
        username,
    });
    if (!doc)
        return null;
    return decryptSteamAccount(doc);
}
/**
 * Return all steam accounts without sensitive information
 */
export async function getAll(userId) {
    const collection = await getCollection(collectionName);
    const cursor = collection.find({ userId });
    const accounts = (await cursor.toArray());
    for (const acc of accounts) {
        delete acc.auth;
        delete acc.userId;
    }
    return accounts;
}
/**
 * Helper functions
 */
function encryptSteamAccount(steamAccount) {
    const account = (({ auth, ...others }) => {
        return { ...others, auth: encrypt(JSON.stringify(auth)) };
    })(steamAccount);
    return account;
}
function decryptSteamAccount(steamAccount) {
    const decryptedAuth = JSON.parse(decrypt(steamAccount.auth));
    const account = (({ auth, ...others }) => {
        return { ...others, auth: decryptedAuth };
    })(steamAccount);
    account.auth.sentry = Buffer.from(decryptedAuth.sentry.data);
    return account;
}
