import fetch from "node-fetch";
import { getCollection } from "../db.js";
import { SteamIdlerError } from "../commons.js";
const collectionName = "steam-servers";
const STEAMCMS_URL = "https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?format=json&cellid=0";
/**
 * Fetches Steam CMs from the steam api and saves them to 'steam-cms' collection
 */
export async function renew() {
    const collection = await getCollection(collectionName);
    const data = (await fetch(STEAMCMS_URL).then((res) => res.json()));
    const serverList = data.response.serverlist.map((server) => {
        const split = server.split(":");
        const steamcm = { ip: split[0], port: Number(split[1]) };
        return steamcm;
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
