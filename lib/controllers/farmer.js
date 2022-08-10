import { ERRORS, getSteamCommunity, SteamAccountExistsOnline, SteamIdlerError } from "../commons.js";
import { SteamcommunityError } from "steamcommunity-api";
import retry from "@machiavelli/retry";
import * as SteamAccountModel from "../models/steam-accounts.js";
import SteamStore from "../models/steam-store.js";
import { steamWebLogin } from "./steamcommunity-actions.js";
const FarmingIntervals = new Map();
/**
 * Start Farmer
 * @controller
 */
export async function start(userId, username) {
    await SteamAccountExistsOnline(userId, username);
    if (FarmingIntervals.has(username))
        throw new SteamIdlerError(ERRORS.ALREADY_FARMING);
    await runFarmingAlgo(userId, username);
    // run farming algo at process.env.FARMING_INTERVAL_MINUTES
    const interval = setInterval(async () => {
        console.log(`Running FarmingAlgo: ${username}`);
        try {
            await runFarmingAlgo(userId, username);
        }
        catch (error) {
            // don't throw on fail
            console.log(error);
        }
    }, Number(process.env.FARMING_INTERVAL_MINUTES) * 60 * 1000);
    FarmingIntervals.set(username, interval);
}
async function runFarmingAlgo(userId, username) {
    try {
        await farmingAlgo(userId, username);
    }
    catch (error) {
        await stop(userId, username);
        throw error;
    }
}
/**
 * Stop Farming
 * @controller
 */
export async function stop(userId, username) {
    const interval = FarmingIntervals.get(username);
    if (!interval)
        return;
    clearInterval(interval);
    const steam = SteamStore.get(userId, username);
    if (steam)
        steam.idleGames([]);
    await SteamAccountModel.updateField(userId, username, { "state.farming": false });
}
async function farmingAlgo(userId, username) {
    const steam = SteamStore.get(userId, username);
    if (!steam)
        throw new SteamIdlerError(ERRORS.NOTONLINE);
    // stop idling
    steam.idleGames([]);
    // wait a bit of time to get farmableGames so that idleGames takes effect
    const farmableGames = await new Promise((resolve) => {
        setTimeout(async () => {
            const farmableGames = await getFarmableGames(userId, username);
            resolve(farmableGames);
        }, 3000);
    });
    // update farming state
    await SteamAccountModel.updateField(userId, username, {
        "state.farming": !!farmableGames.length,
        "data.farmableGames": farmableGames,
    });
    if (!farmableGames.length)
        throw new SteamIdlerError(ERRORS.NO_FARMABLE_GAMES);
    steam.idleGames(get32FarmableGameIds(farmableGames));
}
/**
 * wrap around Steamcommunity.GetFarmableGames() so it doesn't fail
 */
export async function getFarmableGames(userId, username) {
    const steamAccount = await SteamAccountModel.get(userId, username);
    return new Promise((resolve, reject) => {
        let steamcommunity = getSteamCommunity(steamAccount);
        const operation = new retry({ retries: 3, interval: 1000 });
        operation.attempt(async (currentAttempt) => {
            // steam must be online
            if (!SteamStore.has(userId, username))
                return reject(new SteamIdlerError(ERRORS.NOTONLINE));
            try {
                const farmableGames = await steamcommunity.getFarmableGames();
                return resolve(farmableGames);
            }
            catch (error) {
                console.log(`Attempting getFarmableGames #${currentAttempt}: ${username}`);
                if (error instanceof SteamcommunityError) {
                    if (error.message === "CookieExpired") {
                        // this should not fail, but it can
                        const res = await steamWebLogin({ type: "relogin", relogin: { userId, username } });
                        // assign new steamcommunity that contains new cookie
                        steamcommunity = res.steamcommunity;
                    }
                }
                // attempt retry
                if (operation.retry())
                    return;
                // operation failed
                reject(error);
            }
        });
    });
}
function get32FarmableGameIds(FarmableGames) {
    FarmableGames.slice(32);
    return FarmableGames.map((game) => game.appId);
}
