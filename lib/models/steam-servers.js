import fetch from "node-fetch";
import { getCollection } from "../db.js";
import { SteamIdlerError } from "../commons.js";
const collectionName = "steam-cms";
const STEAMCMS_URL = "https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?format=json&cellid=0";
/**
 * Fetches Steam CMs from the steam api and saves them to 'steam-cms' collection
 */
export async function fetchSteamServers() {
    const collection = await getCollection(collectionName);
    const res = await fetch(STEAMCMS_URL);
    const data = (await res.json());
    const serverList = data.response.serverlist.map((server) => {
        const split = server.split(":");
        return { ip: split[0], port: Number(split[1]) };
    });
    await collection.deleteMany({});
    await collection.insertMany(serverList);
}
/**
 * @returns random SteamCM
 */
export async function getOne() {
    const collection = await getCollection(collectionName);
    const cursor = collection.aggregate([{ $sample: { size: 1 } }]);
    const server = await cursor.next();
    if (!server)
        throw new SteamIdlerError("EmptySteamCMList");
    return server;
}
