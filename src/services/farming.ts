import { SteamAccountExistsOnline, SteamIdlerError } from "../commons.js";
import * as SteamAccountModel from "../models/steamAccount.js";
import { ObjectId } from "mongodb";
import { steamStore, wsServer } from "../app.js";
import { StartBody } from "../../@types/controllers/farming.js";
import { getFarmableGames } from "./steamWeb.js";

const FarmingIntervals: Map<string, NodeJS.Timer> = new Map();

/**
 * Start Farmer
 * @Service
 */
export async function start(userId: ObjectId, body: StartBody) {
  await SteamAccountExistsOnline(userId, body.accountName);

  if (FarmingIntervals.has(body.accountName)) {
    throw new SteamIdlerError("Already farming.");
  }

  await farmingAlgo(userId, body, { skip: true });

  // run farming algo at process.env.FARMING_INTERVAL_MINUTES
  const interval = setInterval(async () => {
    console.log(`Running FarmingAlgo: ${body.accountName}`);
    try {
      await farmingAlgo(userId, body);
    } catch (error) {
      // don't throw on fail
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
export async function stop(userId: ObjectId, body: StartBody) {
  await SteamAccountExistsOnline(userId, body.accountName);

  const interval = FarmingIntervals.get(body.accountName);
  if (!interval) {
    throw new SteamIdlerError("Not farming.");
  }

  clearInterval(interval);

  const steam = steamStore.get(userId, body.accountName);
  if (steam) await steam.client.gamesPlayed([]);

  await SteamAccountModel.updateField(userId, body.accountName, { "state.gamesIdsFarm": [] });
  wsServer.send({ userId, routeName: "farming/stop", type: "Success" });
}

async function farmingAlgo(userId: ObjectId, body: StartBody, options?: { skip?: boolean }) {
  const steam = steamStore.get(userId, body.accountName);
  if (!steam) throw new SteamIdlerError("Account is not online.");

  const steamAccount = await SteamAccountModel.getByUserId(userId, { accountName: body.accountName });

  if (steamAccount.state.gamesIdsFarm.length || steamAccount.state.gamesIdsIdle.length) {
    await steam.client.gamesPlayed([]);
  }

  if (!options || !options.skip) {
    const farmableGames = await getFarmableGames(userId, { accountName: body.accountName });
    if (!farmableGames.length) {
      await stop(userId, body);
      throw new SteamIdlerError("No games to farm.");
    }
  }

  await steam.client.gamesPlayed(body.gameIds);
  await SteamAccountModel.updateField(userId, body.accountName, { "state.gamesIdsFarm": body.gameIds });
}
