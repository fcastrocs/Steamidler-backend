import crypto from "crypto";
import { getCollection } from "../db.js";
const collectionName = "invites";
export async function add(email) {
    const collection = await getCollection(collectionName);
    const code = crypto.randomBytes(8).toString("hex"); // generates string of length 16
    const invite = { email, code, createdAt: new Date() };
    await collection.insertOne(invite);
    return code;
}
export async function exits(email, inviteCode) {
    const collection = await getCollection(collectionName);
    const invite = (await collection.findOne({ email }));
    if (invite && inviteCode === invite.code)
        return true;
    return false;
}
export async function remove(email) {
    const collection = await getCollection(collectionName);
    await collection.deleteOne({ email });
}
