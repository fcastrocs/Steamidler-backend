import crypto from "crypto";
import { getCollection } from "../db.js";
const collectionName = "invites";
export async function add(email) {
    // santize email
    email = email.toLowerCase();
    const collection = await getCollection(collectionName);
    const code = crypto.randomBytes(32).toString("hex"); // generates string of length 16
    const invite = { email, code, createdAt: new Date() };
    await collection.insertOne(invite);
    return code;
}
export async function exits(invite) {
    const collection = await getCollection(collectionName);
    if (await collection.findOne(invite))
        return true;
    return false;
}
export async function remove(email) {
    const collection = await getCollection(collectionName);
    await collection.deleteOne({ email });
}
