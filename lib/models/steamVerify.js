import { getClient } from "../db.js";
const collectionName = "steam-verify";
export async function add(steamVerify) {
    const collection = (await getClient()).db().collection(collectionName);
    if (await exists(steamVerify.userId, steamVerify.username)) {
        return;
    }
    await collection.insertOne(steamVerify);
}
export async function get(userId, username) {
    const collection = (await getClient()).db().collection(collectionName);
    const doc = await collection.findOne({
        userId,
        username,
    });
    if (!doc)
        return null;
    return doc;
}
export async function remove(userId, username) {
    const collection = (await getClient()).db().collection(collectionName);
    await collection.deleteOne({ userId, username });
}
async function exists(userId, username) {
    const collection = (await getClient()).db().collection(collectionName);
    const doc = await collection.findOne({
        userId,
        username,
    });
    return !!doc;
}
