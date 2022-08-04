import { getCollection } from "../db.js";
const collectionName = "invites";
export async function exists(invite, email) {
    const collection = await getCollection(collectionName);
    const doc = await collection.findOne({ invite, email });
    return !!doc;
}
export async function remove(email) {
    const collection = await getCollection(collectionName);
    await collection.deleteMany({ email });
}
