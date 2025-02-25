import { SteamIdlerError } from "../commons.js";
import * as SteamAccountModel from "../models/steamAccount.js";
import { ObjectId } from "mongodb";
import { steamStore, wsServer } from "../app.js";
import { StartBody, StopBody } from "../../@types/controllers/farming.js";
import { getFarmableGames } from "./steamWeb.js";
import { SteamAccount } from "../../@types/models/steamAccount.js";

const FarmingIntervals: Map<string, NodeJS.Timer> = new Map();

/**
 * Start Farmer
 * @Service
 */
export async function start(userId: ObjectId, body: StartBody) {
  if (FarmingIntervals.has(body.accountName)) {
    throw new SteamIdlerError("Already farming.");
  }

  const steam = steamStore.get(userId, body.accountName);
  if (!steam) {
    throw new SteamIdlerError("Account is not online.");
  }

  // account is playing elsewhere.
  if (steam.client.isPlayingBlocked) {
    throw new SteamIdlerError("Account has a playing session elsewhere.");
  }

  if (!body.gameIds.length) {
    throw new SteamIdlerError("Could not start farming, no gameIds passed.");
  }

  await farmingAlgo(userId, body, { skip: true });

  // run farming algo at process.env.FARMING_INTERVAL_MINUTES
  const interval = setInterval(async () => {
    console.log(`Running FarmingAlgo: ${body.accountName}`);
    try {
      await farmingAlgo(userId, body);
    } catch (error) {
      // don't throw on fail or app will crash.
      console.log(error);
    }
  }, Number(process.env.FARMING_INTERVAL_MINUTES) * 60 * 1000);

  FarmingIntervals.set(body.accountName, interval);
  wsServer.send({ userId, routeName: "farming/start", type: "Success", message: { gameIds: body.gameIds } });
}

/**
 * Stop Farming
 * @Service
 */
export async function stop(userId: ObjectId, body: StopBody) {
  const steam = steamStore.get(userId, body.accountName);
  if (!steam) {
    throw new SteamIdlerError("Account is not online.");
  }

  const interval = FarmingIntervals.get(body.accountName);
  if (!interval) {
    throw new SteamIdlerError("Not farming.");
  }

  clearInterval(interval);
  FarmingIntervals.delete(body.accountName);

  // stop idling
  await steam.client.gamesPlayed([]);

  const account = await SteamAccountModel.updateField(userId, body.accountName, {
    "state.gamesIdsFarm": [],
    "state.status": "online" as SteamAccount["state"]["status"],
  });

  wsServer.send({ userId, routeName: "farming/stop", type: "Success", message: account });
}

async function farmingAlgo(userId: ObjectId, body: StartBody, options?: { skip?: boolean }) {
  const steam = steamStore.get(userId, body.accountName);

  // stop all idling
  await steam.client.gamesPlayed([]);

  // don't fetch games the first time this gets executed
  if (!options || !options.skip) {
    const farmableGames = await getFarmableGames(userId, { accountName: body.accountName });
    if (!farmableGames.length) {
      await stop(userId, body);
      throw new SteamIdlerError("No games to farm.");
    }
  }

  await steam.client.gamesPlayed(body.gameIds);
  await SteamAccountModel.updateField(userId, body.accountName, {
    "state.gamesIdsFarm": body.gameIds,
    "state.status": "ingame" as SteamAccount["state"]["status"],
  });
}
