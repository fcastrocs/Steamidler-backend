/**
 * Connects to mongodb.
 */
import { MongoClient } from "mongodb";
import { config } from "dotenv";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });
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
