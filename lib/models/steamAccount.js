import { getClient } from "../db.js";
import crypto from "crypto";
const collectionName = "steam-accounts";
/**
 * Add steamAccount to collection
 */
export async function add(steamAccount) {
    const collection = (await getClient()).db().collection(collectionName);
    const doc = await get(steamAccount.userId, steamAccount.username);
    if (doc)
        throw "Account already exists.";
    const encrypedAccount = encryptSteamAccount(steamAccount);
    await collection.insertOne(encrypedAccount);
}
/**
 * update steamAccount
 */
export async function update(steamAccount) {
    const collection = (await getClient()).db().collection(collectionName);
    const encrypedAccount = encryptSteamAccount(steamAccount);
    await collection.updateOne({ userId: steamAccount.userId, username: steamAccount.username }, {
        $set: encrypedAccount,
    });
}
/**
 * update fields for a single steamAccount with userId and username
 */
export async function updateField(userId, username, update) {
    const collection = (await getClient()).db().collection(collectionName);
    await collection.updateOne({ userId, username }, {
        $set: update,
    });
}
/**
 * Remove steamAccount with userId and username
 */
export async function remove(userId, username) {
    const collection = (await getClient()).db().collection(collectionName);
    const doc = await collection.findOneAndDelete({ userId, username });
    if (!doc)
        return null;
    return doc.value;
}
/**
 * Check whether a steamAccount with userId and username exists in collection
 */
export async function exists(userId, username) {
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
export async function get(userId, username) {
    const collection = (await getClient()).db().collection(collectionName);
    const doc = await collection.findOne({
        userId,
        username,
    });
    if (!doc)
        return null;
    // decrypt auth
    doc.auth = JSON.parse(decrypt(doc.auth));
    // convert string sentry to buffer
    doc.auth.sentry = Buffer.from(doc.auth.sentry, "hex");
    return doc;
}
/**
 * Return all steam accounts without sensitive information that match userId
 */
export async function getAll(userId) {
    const collection = (await getClient()).db().collection(collectionName);
    const cursor = collection.find({ userId });
    const documents = await cursor.toArray();
    const steamAccounts = [];
    for (const doc of documents) {
        const steamAccount = {
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
function encryptSteamAccount(steamAccount) {
    // convert sentry buffer to string
    steamAccount.auth.sentry = steamAccount.auth.sentry.toString("hex");
    const encrypedAccount = {
        userId: steamAccount.userId,
        username: steamAccount.username,
        auth: encrypt(JSON.stringify(steamAccount.auth)),
        data: steamAccount.data,
        state: steamAccount.state,
    };
    return encrypedAccount;
}
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(process.env.ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString("hex"), data: encrypted.toString("hex") };
}
function decrypt(text) {
    const iv = Buffer.from(text.iv, "hex");
    const encryptedText = Buffer.from(text.data, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(process.env.ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
