import * as ProxyModel from "../models/proxy.js";
import * as SteamServerModel from "../models/steamServer.js";
import * as ProxiesStatusModel from "../models/proxyStatus.js";
import { SocksClient, SocksClientOptions } from "socks";
import { ResultsMap } from "../../@types/services/proxyStatus.js";
import { SteamIdlerError } from "../commons.js";

let intervalId: NodeJS.Timer;

export async function start() {
  if (intervalId) {
    throw new SteamIdlerError("Proxies status service is already running.");
  }
  await runResults();
  intervalId = setInterval(runResults, 10 * 60 * 1000);
}

export async function stop() {
  clearInterval(intervalId);
}

export function getResults() {
  return ProxiesStatusModel.getResults();
}

async function runResults() {
  const proxies = await ProxyModel.getAll();
  if (!proxies.length) return;

  const steamCMcount = await SteamServerModel.getCount();
  if (!steamCMcount) return;

  const isAlive = [];
  const isSteamConnectable = [];

  // check if proxies are alive
  for (const proxy of proxies) {
    isAlive.push(isProxyAlive(proxy));
  }
  const aliveResults = await Promise.allSettled(isAlive);

  // check connectivity to steam
  for (const result of aliveResults) {
    if (result.status === "rejected") continue;
    isSteamConnectable.push(isProxySteamConnectable(result.value));
  }
  const steamConnnectResults = await Promise.allSettled(isSteamConnectable);

  const aliveResultsMap: ResultsMap = aliveResults.reduce((map, obj) => {
    if (obj.status === "fulfilled") {
      map.set(obj.value._id.toString(), obj.value);
    } else {
      map.set(obj.reason._id.toString(), obj.reason);
    }
    return map;
  }, new Map());

  const steamConnnectResultsMap: ResultsMap = steamConnnectResults.reduce((map, obj) => {
    if (obj.status === "fulfilled") {
      map.set(obj.value._id.toString(), obj.value);
    } else {
      map.set(obj.reason._id.toString(), obj.reason);
    }
    return map;
  }, new Map());

  await ProxiesStatusModel.add(aliveResultsMap, steamConnnectResultsMap);
}

async function isProxyAlive(proxy: Proxy) {
  const options: SocksClientOptions = {
    proxy: {
      host: proxy.ip,
      port: proxy.port,
      type: 5,
      userId: process.env.PROXY_USER,
      password: process.env.PROXY_PASS,
    },
    command: "connect",
    destination: {
      host: "google.com",
      port: 80,
    },
  };

  // Async/Await
  try {
    const info = await SocksClient.createConnection(options);
    info.socket.destroy();
    return proxy;
  } catch (err) {
    throw { ...proxy, error: err.message };
  }
}

async function isProxySteamConnectable(proxy: Proxy) {
  const steamCM = await SteamServerModel.getOne();

  const options: SocksClientOptions = {
    proxy: {
      host: proxy.ip,
      port: proxy.port,
      type: 5,
      userId: process.env.PROXY_USER,
      password: process.env.PROXY_PASS,
    },
    command: "connect",
    destination: {
      host: steamCM.ip,
      port: steamCM.port,
    },
  };

  // Async/Await
  try {
    const info = await SocksClient.createConnection(options);
    info.socket.destroy();
    return proxy;
  } catch (err) {
    throw { ...proxy, error: err.message };
  }
}
