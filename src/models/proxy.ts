import axios from "axios";
import { getClient } from "../db";

interface Proxy {
  ip: string;
  port: number;
}

/**
 * Fetches proxies from proxies provider
 */
export async function fetchProxies(): Promise<void> {
  const collection = getClient().db().collection("proxies");

  try {
    const res = await axios.get(
      "https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?format=json&cellid=0"
    );

    const documents = [];

    for (const item of res.data.response.serverlist) {
      const split = item.split(":");
      const ip = split[0];
      const port = Number(split[1]);
      const proxy: Proxy = { ip, port };
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
 * @returns random proxy
 */
export async function getOne(): Promise<Proxy> {
  const collection = getClient().db().collection("proxies");
  const cursor = collection.aggregate([{ $sample: { size: 1 } }]);
  const document = await cursor.next();

  if (document == null) throw "Could fetch a proxy from db.";

  const proxy: Proxy = {
    ip: document.ip,
    port: document.port,
  };

  return proxy;
}
