import { getCollection } from "../db.js";
const collectionName = "steam-verifications";
export async function add(steamVerify) {
    const collection = await getCollection(collectionName);
    await collection.insertOne(steamVerify);
}
export async function get(userId) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOne({ userId });
    return doc;
}
export async function remove(userId) {
    const collection = await getCollection(collectionName);
    const res = await collection.deleteOne({ userId });
    return !!res.deletedCount;
}
