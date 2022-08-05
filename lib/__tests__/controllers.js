import assert from "assert";
import Steam from "steam-client";
import SteamStore from "../controllers/steam-store.js";
import * as SteamAccountsController from "../controllers/steam-accounts.js";
import * as SteamAccountModel from "../models/steam-accounts.js";
import { eventEmitter } from "../commons.js";
const userId = "1";
describe("Controller farmer", () => {
    //
});
describe("Controller steam-store", () => {
    const userId = "userId";
    const username = "username";
    it("add()", () => {
        SteamStore.add(userId, username, new Steam({}));
        // should throw on duplicate
        assert.throws(function () {
            SteamStore.add(userId, username, new Steam({}));
        }, { message: "Exists", name: "steamidler" });
        SteamStore.add(userId, username + "1", new Steam({}));
    });
    it("remove()", () => {
        SteamStore.remove(userId, username);
        assert.equal(SteamStore.has(userId, username), false);
        assert.equal(SteamStore.has(userId, username + "1"), true);
        SteamStore.remove(userId, username + "1");
        assert.equal(SteamStore.has(userId, username + "1"), false);
    });
    it("has()", () => {
        assert.equal(SteamStore.has(userId, username), false);
        assert.equal(SteamStore.has(userId, username + "1"), false);
        SteamStore.add(userId, username, new Steam({}));
        SteamStore.add(userId, username + "1", new Steam({}));
        assert.equal(SteamStore.has(userId, username), true);
        assert.equal(SteamStore.has(userId, username + "1"), true);
    });
    it("get()", () => {
        const steam = new Steam({});
        const steam2 = new Steam({});
        SteamStore.add(userId, username + "2", steam);
        SteamStore.add(userId, username + "3", steam2);
        const steamReceived = SteamStore.get(userId, username + "2");
        const steamReceived2 = SteamStore.get(userId, username + "3");
        assert.equal(steamReceived, steam);
        assert.equal(steamReceived2, steam2);
    });
});
describe("Controller steam-accounts", () => {
    it("add()", async () => {
        await assert.rejects(SteamAccountsController.add(userId, process.env.STEAM_USERNAME, process.env.STEAM_PASSWORD), (err) => {
            assert.equal(err.name, "steamidler");
            assert.equal(err.message, "Exists");
            return true;
        });
    });
    step("login()", async () => {
        await SteamAccountsController.login(userId, process.env.STEAM_USERNAME);
        const steamAccount = await SteamAccountModel.get(userId, process.env.STEAM_USERNAME);
        assert.equal(steamAccount.state.status, "online");
        await assert.rejects(SteamAccountsController.login(userId, process.env.STEAM_USERNAME), (err) => {
            assert.equal(err.name, "steamidler");
            assert.equal(err.message, "AlreadyOnline");
            return true;
        });
    });
    step("simulate disconnect, should reconnect", async function () {
        this.timeout(30000);
        const steam = SteamStore.get(userId, process.env.STEAM_USERNAME);
        steam.disconnect();
        steam.emit("disconnected");
        return new Promise((resolve, reject) => {
            eventEmitter.on("reconnected", resolve);
            eventEmitter.emit("reconnectFailed", reject);
        });
    });
    step("logout()", async () => {
        await SteamAccountsController.logout(userId, process.env.STEAM_USERNAME);
        const steamAccount = await SteamAccountModel.get(userId, process.env.STEAM_USERNAME);
        assert.equal(steamAccount.state.status, "offline");
    });
});
describe("Controller steam-store", () => {
    //
});
describe("Controller steamclient-actions", () => {
    //
});
describe("Controller steamcommunity-actions", () => {
    //
});
