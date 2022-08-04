import { getCollection } from "../db.js";
const collectionName = "steam-verify";
export async function add(steamVerify) {
    const collection = await getCollection(collectionName);
    await collection.insertOne(steamVerify);
}
export async function get(userId, username) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOne({
        userId,
        username,
    });
    return doc;
}
export async function remove(userId, username) {
    const collection = await getCollection(collectionName);
    await collection.deleteOne({ userId, username });
}
