import { ObjectId } from "mongodb";
import { ERRORS, SteamIdlerError } from "../commons.js";
import { getCollection } from "../db.js";
import * as ProxyStatusModel from "./proxyStatus.js";
const collectionName = "proxies";

export async function add(proxies: Proxy[]): Promise<number> {
  const collection = await getCollection(collectionName);

  // delete existing proxies
  await collection.deleteMany({});
  const res = await collection.insertMany(proxies);
  await ProxyStatusModel.deleteAll();
  return res.insertedCount;
}

/**
 * Increase load value by one
 */
export async function increaseLoad(_id: ObjectId): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const res = await collection.updateOne(
    { _id, load: { $lt: Number(process.env.PROXY_LOAD_LIMIT) } },
    { $inc: { load: 1 } },
    { upsert: false }
  );
  return !!res.modifiedCount;
}

/**
 * Decrease load value by one
 */
export async function decreaseLoad(_id: ObjectId): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const res = await collection.updateOne({ _id, load: { $gt: 0 } }, { $inc: { load: -1 } }, { upsert: false });
  return !!res.modifiedCount;
}

/**
 * @returns random proxy with less than process.env.PROXYLOAD
 */
export async function getOne(): Promise<Proxy> {
  const collection = await getCollection(collectionName);
  console.log(process.env.PROXY_LOAD_LIMIT)
  const cursor = collection.find({ load: { $lt: Number(process.env.PROXY_LOAD_LIMIT) } }, { projection: { load: 0 } });
  const proxies = await cursor.toArray();
  console.log(proxies)
  // no proxies or limit reached
  if (!proxies.length) throw new SteamIdlerError(ERRORS.PROXY_LIMIT_REACHED);
  return proxies[Math.floor(Math.random() * proxies.length)] as unknown as Proxy;
}

export async function getAll() {
  const collection = await getCollection(collectionName);
  return (await collection.find({}).toArray()) as unknown as Proxy[];
}

export async function getById(_id: ObjectId) {
  const collection = await getCollection(collectionName);
  return collection.findOne({ _id }) as unknown as Proxy;
}

export async function remove(proxy: Proxy): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.deleteOne(proxy);
}
