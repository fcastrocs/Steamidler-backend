import { getCollection } from "../db.js";
const collectionName = "users";
/**
 * Insert or update User
 */
export async function upsert(user) {
    const collection = await getCollection(collectionName);
    await collection.updateOne({ userId: user.userId }, { $set: user }, { upsert: true });
}
export async function get(userId) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOne({ userId });
    return doc;
}
export async function remove(userId) {
    const collection = await getCollection(collectionName);
    await collection.deleteOne({ userId });
}
