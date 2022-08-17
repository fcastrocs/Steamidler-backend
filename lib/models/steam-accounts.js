import { getCollection } from "../db.js";
import { decrypt, encrypt, ERRORS, SteamIdlerError } from "../commons.js";
const collectionName = "steam-accounts";
/**
 * Add steamAccount to collection
 */
export async function add(steamAccount) {
    const collection = await getCollection(collectionName);
    const encrypedAccount = encryptSteamAccount(steamAccount);
    await collection.insertOne(encrypedAccount);
}
/**
 * update fields for a single steamAccount with userId and username
 * Do not use with account auth. Use 'update' instead
 */
export async function updateField(userId, username, update) {
    if (update.userId || update.username) {
        throw new SteamIdlerError(ERRORS.INVALID_UPDATE_FIELDS);
    }
    // need to encrypt auth before updating
    if (update.auth) {
        update = encryptSteamAccount(update);
    }
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
    const cursor = collection.find({ userId }, { projection: { auth: 0, userId: 0 } });
    const accounts = (await cursor.toArray());
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const account = (({ auth, ...others }) => {
        return { ...others, auth: decryptedAuth };
    })(steamAccount);
    account.auth.sentry = Buffer.from(decryptedAuth.sentry.data);
    return account;
}
