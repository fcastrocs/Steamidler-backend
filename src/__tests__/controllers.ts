import assert from "assert";
import SteamStore from "../models/steam-store.js";
import * as SteamAccountsController from "../controllers/steam-accounts.js";
import * as SteamAccountModel from "../models/steam-accounts.js";
import { eventEmitter } from "../commons.js";
import * as SteamClientActions from "../controllers/steamclient-actions.js";
import * as SteamCommunityActions from "../controllers/steamcommunity-actions.js";
import * as Farmer from "../controllers/farmer.js";
import fetch from "node-fetch";

const userId = "1";
const username = process.env.STEAM_USERNAME;
const password = process.env.STEAM_PASSWORD;
const avatar = "https://avatars.akamai.steamstatic.com/1e8368604f30760f678db658ff5f7fba92764b50_full.jpg";

describe("Controller steam-accounts", () => {
  // step("add()", async () => {
  //   await assert.rejects(SteamAccountsController.add(userId, username, password, process.env.STEAM_CODE), (err: Error) => {
  //     console.log(err);
  //     return true;
  //   });
  // });

  step("login()", async () => {
    if (SteamStore.has(userId, username)) return;

    await SteamAccountsController.login(userId, username);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(steamAccount.state.status, "online");

    // await assert.rejects(SteamAccountsController.login(userId, username), (err: Error) => {
    //   assert.equal(err.name, "steamidler");
    //   assert.equal(err.message, "AlreadyOnline");
    //   return true;
    // });
  });

  step("logout()", async () => {
    await SteamAccountsController.logout(userId, username);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(steamAccount.state.status, "offline");
  });

  step("login()", async () => {
    await SteamAccountsController.login(userId, username);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(steamAccount.state.status, "online");

    await assert.rejects(SteamAccountsController.login(userId, username), (err: Error) => {
      assert.equal(err.name, "steamidler");
      assert.equal(err.message, "AlreadyOnline");
      return true;
    });
  });

  step("simulate disconnect, should reconnect", async function () {
    this.timeout(60000);
    const steam = SteamStore.get(userId, username);
    steam.disconnect();
    steam.emit("disconnected");

    return new Promise((resolve, reject) => {
      eventEmitter.on("reconnected", resolve);
      eventEmitter.emit("reconnectFailed", reject);
    });
  });
});

describe("Controller steamclient-actions", () => {
  it("activatef2pgame()", async () => {
    await SteamClientActions.activatef2pgame(userId, username, [730]);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(
      steamAccount.data.games.some((game) => game.gameid === 730),
      true
    );
  });

  it("idleGames()", async () => {
    await SteamClientActions.idleGames(userId, username, [730]);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(steamAccount.state.gamesIdsIdle[0], 730);
  });

  it("changeNick()", async () => {
    const nick = "Machiavelli" + Math.floor(Math.random() * 20 + 1);
    await SteamClientActions.changeNick(userId, username, nick);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(steamAccount.data.nickname, nick);
  });

  it("cdkeyRedeem()", async () => {
    await assert.rejects(SteamClientActions.cdkeyRedeem(userId, username, "76CPE-E4CYG-5DXDG"), (err: Error) => {
      assert.equal(err.name, "steam-client");
      assert.equal(err.message, "DuplicateActivationCode");
      return true;
    });
  });
});

describe("Controller farmer", () => {
  step("start()", async () => {
    await Farmer.start(userId, username);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(steamAccount.state.farming, true);
    assert.notEqual(steamAccount.data.farmableGames.length, 0);
  });

  // it("stop()", async () => {
  //   await Farmer.stop(userId, username);
  //   const steamAccount = await SteamAccountModel.get(userId, username);
  //   assert.equal(steamAccount.state.farming, false);
  // });
});

describe("Controller steamcommunity-actions", () => {
  step("steamWebLogin()", async () => {
    const { cookie } = await SteamCommunityActions.steamWebLogin({
      type: "relogin",
      relogin: { userId, username },
    });
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.deepStrictEqual(cookie, steamAccount.auth.cookie);
  });

  it("changeAvatar()", async () => {
    // get image blob
    const blob = await fetch(avatar).then((res) => res.blob());

    // convert to dataURL
    const arrayBuffer = await blob.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const dataurl = `data:${blob.type};base64,${base64Data}`;

    await SteamCommunityActions.changeAvatar(userId, username, dataurl);
  });

  it("clearAliases()", async () => {
    await SteamCommunityActions.clearAliases(userId, username);
  });

  it("changePrivacy()", async () => {
    await SteamCommunityActions.changePrivacy(userId, username, "public");
  });
});
