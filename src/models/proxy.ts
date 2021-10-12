import { getClient } from "../db";
import { Proxy } from "@types";

interface ProxyModel extends Proxy {
  load: number;
}

/**
 * Fetches proxies from proxies provider
 */
export async function fetchProxies(): Promise<void> {
  const collection = (await getClient()).db().collection("proxies");

  try {
    const documents = [];

    const proxies = ["proxies array"];

    for (const item of proxies) {
      const split = item.split(":");
      const ip = split[0];
      const port = Number(split[1]);
      const proxy: ProxyModel = { ip, port, load: 0 };
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
 * increases load value by one
 */
export async function updateLoad(proxy: Proxy): Promise<void> {
  const collection = (await getClient()).db().collection("proxies");
  await collection.updateOne(proxy, { $inc: { load: 1 } });
}

/**
 * @returns random proxy with less than process.env.PROXYLOAD
 */
export async function getOne(): Promise<Proxy> {
  const collection = (await getClient()).db().collection("proxies");
  const cursor = collection.aggregate([
    { $match: { load: { $lt: Number(process.env.PROXYLOAD) } } },
    { $sample: { size: 1 } },
  ]);
  const document = await cursor.next();
  if (document == null) throw "Could fetch a proxy from db.";
  const proxy: Proxy = {
    ip: document.ip,
    port: document.port,
  };
  return proxy;
}
