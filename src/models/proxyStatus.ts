import { ProxyStatus, ProxyStatusResults } from "../../@types/models/proxyStatus";
import { ResultsMap } from "../../@types/services/proxyStatus";
import { getCollection } from "../db.js";
const collectionName = "proxies-status";

const MAXSIZE = 40;

/**
 * Fetches proxies from proxies provider
 */
export async function add(aliveResultsMap: ResultsMap, steamConnectResultsMap: ResultsMap) {
  const proxiesStatus = await get();

  if (!proxiesStatus.length) {
    for (const [key, value] of aliveResultsMap.entries()) {
      const steamConnectResult = steamConnectResultsMap.get(value._id.toString());

      const proxyStatus: ProxyStatus = {
        proxyId: value._id,
        aliveStatus: new Array(value.error || "OK"),
        steamConnectStatus: new Array(steamConnectResult && !steamConnectResult.error ? "OK" : "DEAD"),
        index: 1,
      };

      proxiesStatus.push(proxyStatus);
    }
  }

  // add results to status
  for (const status of proxiesStatus) {
    const aliveResults = aliveResultsMap.get(status.proxyId.toString());
    const steamConnectResult = steamConnectResultsMap.get(status.proxyId.toString());

    // update arrays in a circular manner
    const index = status.index >= MAXSIZE ? 0 : status.index;
    status.aliveStatus[index] = aliveResults.error || "OK";
    status.steamConnectStatus[index] = steamConnectResult && !steamConnectResult.error ? "OK" : "DEAD";
    status.index = index + 1;
  }

  const collection = await getCollection(collectionName);
  await collection.deleteMany({});
  await collection.insertMany(proxiesStatus);
}

async function get() {
  const collection = await getCollection(collectionName);
  return (await collection.find({}).toArray()) as unknown as ProxyStatus[];
}

export async function getResults() {
  // const collection = await getCollection("proxies");
  // const cursor = collection.aggregate([
  //   {
  //     $lookup: {
  //       from: "proxies-status",
  //       localField: "_id",
  //       foreignField: "proxyId",
  //       as: "results",
  //     },
  //   },
  // ]);

  const collection = await getCollection(collectionName);

  const cursor = collection.find({});
  return cursor.toArray() as unknown as ProxyStatusResults[];
}
