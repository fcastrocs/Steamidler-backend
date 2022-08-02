import { ERRORS, getSteamCommunity, normalizeError, SteamAccountExistsOnline } from "../commons.js";
import { FarmableGame } from "steamcommunity-api";
import { IdleGame } from "steam-client";
import retry from "@machiavelli/retry";
import { steamWebLogin } from "./steamAccount.js";
import { Farming } from "../../@types/index.js";
import * as SteamAccountModel from "../models/steamAccount.js";
import SteamStore from "./steamStore.js";

const FarmingIntervals: Map<string, NodeJS.Timer> = new Map();

/**
 * Start Farmer
 * @controller
 */
export async function startFarmer(userId: string, username: string) {
  await SteamAccountExistsOnline(userId, username);
  if (FarmingIntervals.has(username)) throw ERRORS.ALREADY_FARMING;

  async function runFarmingAlgo() {
    try {
      await farmingAlgo(userId, username);
    } catch (error) {
      await stopFarmer(userId, username);
      throw normalizeError(error);
    }
  }

  await runFarmingAlgo();

  // run farming algo at process.env.FARMING_INTERVAL_MINUTESD
  const interval = setInterval(async () => {
    console.log(`Running FarmingAlgo: ${username}`);
    try {
      await runFarmingAlgo();
    } catch (error) {
      console.log(error);
    }
  }, Number(process.env.FARMING_INTERVAL_MINUTES) * 60 * 1000);

  FarmingIntervals.set(username, interval);
}

/**
 * Stop Farming
 * @controller
 */
export async function stopFarmer(userId: string, username: string) {
  const interval = FarmingIntervals.get(username);
  if (!interval) return;

  clearInterval(interval);

  const steam = SteamStore.get(userId, username);
  if (steam) steam.idleGames([]);

  await SteamAccountModel.updateField(userId, username, {
    "state.farming": {
      active: false,
      games: [],
    },
  });
}

async function farmingAlgo(userId: string, username: string) {
  const steam = SteamStore.get(userId, username);
  // stop idling
  steam.idleGames([]);

  // wait a bit of time to get farmableGames so that idleGames takes effect
  const farmableGames: FarmableGame[] = await new Promise((resolve) => {
    setTimeout(async () => {
      const farmableGames = await getFarmableGames(userId, username);
      resolve(farmableGames);
    }, 5000);
  });

  // update farmableGames
  await SteamAccountModel.updateField(userId, username, {
    "data.farmableGames": farmableGames,
  });

  // finished farming
  if (!farmableGames.length) {
    throw ERRORS.NO_FARMABLE_GAMES;
  }

  // update farming state
  const farming: Farming = {
    active: true,
    games: get32FarmableGames(farmableGames),
  };

  await SteamAccountModel.updateField(userId, username, {
    "state.farming": farming,
  });

  steam.idleGames(farming.games);
}

/**
 * Get farmable Games. retry operation if fails.
 */
async function getFarmableGames(userId: string, username: string): Promise<FarmableGame[]> {
  const steamAccount = await SteamAccountModel.get(userId, username);

  return new Promise((resolve, reject) => {
    let steamcommunity = getSteamCommunity(steamAccount);
    const operation = new retry({ retries: 3, interval: 3000 });

    operation.attempt(async (currentAttempt: number) => {
      try {
        const farmableGames = await steamcommunity.getFarmableGames();
        return resolve(farmableGames);
      } catch (error) {
        console.log(`Attempting getFarmableGames #${currentAttempt}: ${username}`);
        if (error.message === "CookieExpired") {
          // this should not fail, but it can
          const res = await steamWebLogin({ type: "relogin", relogin: { userId, username } });
          // assign new steamcommunity that contains new cookie
          steamcommunity = res.steamcommunity;
        }

        // attempt retry
        if (operation.retry()) return;

        // operation failed
        reject(error);
      }
    });
  });
}

function get32FarmableGames(FarmableGames: FarmableGame[]): IdleGame[] {
  FarmableGames.slice(32);
  return FarmableGames.map((game) => {
    return { gameId: game.appId };
  });
}
