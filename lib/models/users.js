import { getCollection } from "../db.js";
const collectionName = "users";
/**
 * Insert or update User
 */
export async function add(user) {
    const collection = await getCollection(collectionName);
    await collection.insertOne(user);
    return user;
}
export async function get(email) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOne({ email });
    return doc;
}
export async function remove(email) {
    const collection = await getCollection(collectionName);
    const res = await collection.deleteOne({ email });
    return !!res.deletedCount;
}
