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
 * update fields for a single steamAccount with userId and accountName
 * Do not use with account auth. Use 'update' instead
 */
export async function updateField(userId, accountName, update) {
    if (update.userId || update.accountName) {
        throw new SteamIdlerError(ERRORS.INVALID_UPDATE_FIELDS);
    }
    // need to encrypt auth before updating
    if (update.auth) {
        update = encryptSteamAccount(update);
    }
    const collection = await getCollection(collectionName);
    await collection.updateOne({ userId, accountName }, {
        $set: update,
    });
}
/**
 * Remove steamAccount with userId and accountName
 */
export async function remove(userId, accountName) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOneAndDelete({ userId, accountName });
    if (!doc)
        return null;
    return doc.value;
}
/**
 * Return a steamAccount with userId and accountName
 */
export async function get(userId, accountName) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOne({
        userId,
        accountName,
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
    // sentry will be deprecated by steam soon, probably.
    // account.auth.sentry = Buffer.from(decryptedAuth.sentry.data);
    return account;
}
