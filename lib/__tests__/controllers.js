import assert from "assert";
import Steam from "steam-client";
import SteamStore from "../controllers/steam-store.js";
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
    //
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
