/**
 * Connects to mongodb.
 */

import { MongoClient } from "mongodb";
import path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "../.env") });

let client: MongoClient;

export async function connect(): Promise<MongoClient> {
  client = new MongoClient(process.env.DB_URI || "", {
    minPoolSize: Number(process.env.POOL_SIZE),
    maxPoolSize: Number(process.env.POOL_SIZE),
    connectTimeoutMS: 300000,
    socketTimeoutMS: 300000,
    serverSelectionTimeoutMS: 300000,
  });

  await client.connect();
  return client;
}

export async function getClient(): Promise<MongoClient> {
  if (!client) throw Error("Not connected to database.");
  return client;
}
