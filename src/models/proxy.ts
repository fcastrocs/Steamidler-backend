import { ObjectId } from "mongodb";
import { ERRORS, SteamIdlerError } from "../commons.js";
import { getCollection } from "../db.js";
const collectionName = "proxies";

export async function add(proxies: string[]): Promise<number> {
  const collection = await getCollection(collectionName);

  const documents: Proxy[] = proxies.map((proxy, index) => {
    const split = proxy.split(":");
    if (!validate(`${split[0]}:${split[1]}`)) throw new SteamIdlerError(ERRORS.PROXY_NOT_VALID);
    const p: Proxy = { name: `Server  ${index + 1}`, ip: split[0], port: Number(split[1]), load: 0 };
    return p;
  });

  // delete existing proxies
  const res = await collection.insertMany(documents);
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
  const cursor = collection.find({ load: { $lt: Number(process.env.PROXY_LOAD_LIMIT) } }, { projection: { load: 0 } });
  const proxies = await cursor.toArray();
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

function validate(proxy: string) {
  const regex = /(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}):(\d{1,5})/;
  return regex.test(proxy);
}
