import assert from "assert";
import SteamStore from "../models/steam-store.js";
import * as SteamAccountsController from "../controllers/steam-accounts.js";
import * as SteamAccountModel from "../models/steam-accounts.js";
import { eventEmitter } from "../commons.js";
import * as SteamClientActions from "../controllers/steamclient-actions.js";
import * as SteamCommunityActions from "../controllers/steamcommunity-actions.js";
import fetch from "node-fetch";
import { arrayBuffer } from "stream/consumers";

const userId = "1";
const username = process.env.STEAM_USERNAME;
const password = process.env.STEAM_PASSWORD;

describe("Controller farmer", () => {
  //
});

describe("Controller steam-accounts", () => {
  it("add()", async () => {
    await assert.rejects(SteamAccountsController.add(userId, username, password), (err: Error) => {
      assert.equal(err.name, "steamidler");
      assert.equal(err.message, "Exists");
      return true;
    });
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
  it("idleGames()", async () => {
    await SteamClientActions.idleGames(userId, username, [730]);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(steamAccount.state.gamesIdsIdle[0], 730);
  });

  it("changeNick()", async () => {
    const nick = "kiddo" + Math.floor(Math.random() * 20 + 1);
    await SteamClientActions.changeNick(userId, username, nick);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(steamAccount.data.nickname, nick);
  });

  it("activatef2pgame()", async () => {
    await SteamClientActions.activatef2pgame(userId, username, [1797880]);
    const steamAccount = await SteamAccountModel.get(userId, username);
    assert.equal(
      steamAccount.data.games.some((game) => game.gameid === 1797880),
      true
    );
  });

  it("cdkeyRedeem()", async () => {
    await assert.rejects(SteamClientActions.cdkeyRedeem(userId, username, "76CPE-E4CYG-5DXDG"), (err: Error) => {
      assert.equal(err.name, "steam-client");
      assert.equal(err.message, "DuplicateActivationCode");
      return true;
    });
  });
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
    const blob = await fetch("https://avatars.steamstatic.com/23e6beb43897c50a8e004af188539b274d06310b_full.jpg").then(
      (res) => res.blob()
    );

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
