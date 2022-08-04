import "dotenv/config";
import { fetchSteamServers, getOne } from "../models/steam-servers.js";
describe("Model invites", async () => {
    //
});
describe("Model proxies", async () => {
    //
});
describe("Model steam-accounts", async () => {
    //
});
describe("Model steam-servers", async () => {
    it("fetchSteamServers()", async () => {
        await fetchSteamServers();
    });
    it("getOne()", async () => {
        await getOne();
    });
});
describe("Model steam-verify", async () => {
    //
});
describe("Model users", async () => {
    //
});
