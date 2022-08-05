import assert from "assert";
import SteamStore from "../models/steam-store.js";
import * as SteamAccountsController from "../controllers/steam-accounts.js";
import * as SteamAccountModel from "../models/steam-accounts.js";
import { eventEmitter } from "../commons.js";

const userId = "1";

describe("Controller farmer", () => {
  //
});

describe("Controller steam-accounts", () => {
  it("add()", async () => {
    await assert.rejects(
      SteamAccountsController.add(userId, process.env.STEAM_USERNAME, process.env.STEAM_PASSWORD),
      (err: Error) => {
        assert.equal(err.name, "steamidler");
        assert.equal(err.message, "Exists");
        return true;
      }
    );
  });

  step("login()", async () => {
    await SteamAccountsController.login(userId, process.env.STEAM_USERNAME);
    const steamAccount = await SteamAccountModel.get(userId, process.env.STEAM_USERNAME);
    assert.equal(steamAccount.state.status, "online");

    await assert.rejects(SteamAccountsController.login(userId, process.env.STEAM_USERNAME), (err: Error) => {
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

describe("Controller steamclient-actions", () => {
  it("idleGames()", () => {
    //
  });

  it("changeNick()", () => {
    //
  });

  step("mergeGamesArrays()", () => {
    //
  });

  it("activatef2pgame()", () => {
    //
  });

  it("cdkeyRedeem()", () => {
    //
  });
});

describe("Controller steamcommunity-actions", () => {
  //
});
