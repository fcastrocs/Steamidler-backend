import { getClient } from "../db.js";
export async function get(userId) {
    const collection = (await getClient()).db().collection("users");
    const doc = await collection.findOne({ userId });
    return doc;
}
export async function upsert(userId, user) {
    const collection = (await getClient()).db().collection("users");
    await collection.updateOne({ userId }, { $set: user }, { upsert: true });
}
