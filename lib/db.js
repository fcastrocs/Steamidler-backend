/**
 * Connects to mongodb.
 */
import { MongoClient } from "mongodb";
const client = new MongoClient(process.env.DB_URI, {
    minPoolSize: Number(process.env.POOL_SIZE),
    maxPoolSize: Number(process.env.POOL_SIZE),
});
export async function connect() {
    await client.connect();
    return client;
}
export async function getClient() {
    if (!client)
        throw Error("Not connected to database.");
    return client;
}
export async function getCollection(name) {
    const client = await getClient();
    return client.db().collection(name);
}
