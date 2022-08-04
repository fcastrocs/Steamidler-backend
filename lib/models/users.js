import { getCollection } from "../db.js";
const collectionName = "users";
export async function get(userId) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOne({ userId });
    return doc;
}
export async function upsert(userId, user) {
    const collection = await getCollection(collectionName);
    await collection.updateOne({ userId }, { $set: user }, { upsert: true });
}
