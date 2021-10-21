/**
 * Connects to mongodb.
 */

import { MongoClient } from "mongodb";
import path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "../.env") });

const client = new MongoClient(process.env.DB_URI, {
  minPoolSize: Number(process.env.POOL_SIZE),
  maxPoolSize: Number(process.env.POOL_SIZE),
});

export async function connect(): Promise<MongoClient> {
  await client.connect();
  return client;
}

export async function getClient(): Promise<MongoClient> {
  if (!client) throw Error("Not connected to database.");
  return client;
}
