import { getClient } from "../db.js";
import { Proxy } from "@types";

const collectionName = "proxies";

/**
 * Fetches proxies from proxies provider
 */
export async function fetchProxies(): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);

  try {
    const documents = [];

    const proxies = ["proxies array"];

    for (const item of proxies) {
      const split = item.split(":");
      const ip = split[0];
      const port = Number(split[1]);
      const proxy: Proxy = { ip, port, load: 0 };
      documents.push(proxy);
    }

    await collection.deleteMany({});
    await collection.insertMany(documents);
  } catch (error) {
    Promise.reject("Could not fetch proxies.");
    console.error(error);
  }
}

/**
 * Increase load value by one
 */
export async function increaseLoad(proxy: Proxy): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  await collection.updateOne(proxy, { $inc: { load: 1 } });
}

/**
 * Decrease load value by one
 */
export async function decreaseLoad(proxy: Proxy): Promise<void> {
  const collection = (await getClient()).db().collection(collectionName);
  await collection.updateOne(proxy, { $inc: { load: -1 } });
}

/**
 * @returns random proxy with less than process.env.PROXYLOAD
 */
export async function getOne(): Promise<Proxy> {
  const collection = (await getClient()).db().collection(collectionName);
  const cursor = collection.aggregate([
    { $match: { load: { $lt: Number(process.env.PROXYLOAD) } } },
    { $sample: { size: 1 } },
  ]);
  const doc = await cursor.next();
  if (doc == null) throw "Could fetch a proxy from db.";
  return doc as Proxy;
}
