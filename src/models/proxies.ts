import { ERRORS, SteamIdlerError } from "../commons.js";
import { Proxy } from "../../@types";
import { getCollection } from "../db.js";
const collectionName = "proxies";

/**
 * Fetches proxies from proxies provider
 */
export async function add(proxies: string[]): Promise<number> {
  const collection = await getCollection(collectionName);

  const documents: Proxy[] = proxies.map((proxy) => {
    const split = proxy.split(":");
    if (!validate(`${split[0]}:${split[1]}`)) throw new SteamIdlerError(ERRORS.PROXY_NOT_VALID);
    const p: Proxy = { ip: split[0], port: Number(split[1]) };
    return { ...p, load: 0 };
  });

  // delete existing proxies
  await collection.deleteMany({});
  const res = await collection.insertMany(documents);
  return res.insertedCount;
}

/**
 * Increase load value by one
 */
export async function increaseLoad(proxy: Proxy): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const res = await collection.updateOne(
    { ip: proxy.ip, port: proxy.port, load: { $lt: Number(process.env.PROXY_LOAD_LIMIT) } },
    { $inc: { load: 1 } },
    { upsert: false }
  );
  return !!res.modifiedCount;
}

/**
 * Decrease load value by one
 */
export async function decreaseLoad(proxy: Proxy): Promise<boolean> {
  const collection = await getCollection(collectionName);
  const res = await collection.updateOne(
    { ip: proxy.ip, port: proxy.port, load: { $gt: 0 } },
    { $inc: { load: -1 } },
    { upsert: false }
  );
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

export async function remove(proxy: Proxy): Promise<void> {
  const collection = await getCollection(collectionName);
  await collection.deleteOne(proxy);
}

function validate(proxy: string) {
  const regex = /(\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}):(\d{1,5})/;
  return regex.test(proxy);
}
