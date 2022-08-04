import assert from "assert";
import "dotenv/config";
import { addProxies, decreaseLoad, deleteProxy, getOneProxy, increaseLoad } from "../models/proxies.js";
import { createInvite, inviteExists, removeInvite } from "../models/invites.js";
import { fetchSteamServers, getOne } from "../models/steam-servers.js";
import { AccountState, SteamAccount, SteamVerify, User } from "../../@types/index.js";
import * as SteamVerifyModel from "../models/steam-verifications.js";
import * as SteamAccountsModel from "../models/steam-accounts.js";
import * as UserModel from "../models/users.js";
import { AccountData } from "steam-client";

describe("Model invites", async () => {
  const email = "email@gmail.com";
  let code = "";

  step("create()", async () => {
    code = await createInvite(email);
    assert.equal(code.length === 16, true);
    // try to insert duplicate

    await assert.rejects(createInvite(email), (err: Error) => {
      assert.equal(err.name, "steamidler");
      assert.equal(err.message, "Exists");
      return true;
    });
  });

  step("get()", async () => {
    const invite = await inviteExists(email, code);
    assert.equal(invite, true);
  });

  it("remove()", async () => {
    await removeInvite(email);
    const exists = await inviteExists(email, code);
    assert.equal(exists, false);
  });
});

describe("Model proxies", async () => {
  process.env.PROXY_LOAD_LIMIT = "1";
  const ip = "185.242.110.74";
  const port = 12324;

  step("addProxies()", async () => {
    // try to add duplicate
    const count = await addProxies([`${ip}:${port}`]);
    assert.equal(count, 1);
    await assert.rejects(addProxies(["123"]), (err: Error) => {
      assert.equal(err.name, "steamidler");
      assert.equal(err.message, "ProxyNotValid");
      return true;
    });
  });

  step("increaseLoad()", async () => {
    let modified = await increaseLoad({ ip, port });
    assert.equal(modified, true);
    modified = await increaseLoad({ ip, port });
    assert.equal(modified, false);
  });

  step("decreaseLoad()", async () => {
    let modified = await decreaseLoad({ ip, port });
    assert.equal(modified, true);
    modified = await decreaseLoad({ ip, port });
    assert.equal(modified, false);
  });

  step("getOneProxy()", async () => {
    await getOneProxy();
    await increaseLoad({ ip, port });
    await assert.rejects(getOneProxy(), (err: Error) => {
      assert.equal(err.name, "steamidler");
      assert.equal(err.message, "ProxyLimitReached");
      return true;
    });
    await decreaseLoad({ ip, port });
    await getOneProxy();
  });

  it("deleteProxy()", async () => {
    await deleteProxy({ ip, port });
    await assert.rejects(getOneProxy(), (err: Error) => {
      assert.equal(err.name, "steamidler");
      assert.equal(err.message, "ProxyLimitReached");
      return true;
    });
  });
});

describe("Model steam-accounts", async () => {
  const steamAccount: SteamAccount = {
    userId: "1",
    username: "username",
    auth: {
      password: "password",
      cookie: { sessionid: "sessionId", steamLoginSecure: "steamLoginSecure" },
      type: "email",
      sentry: Buffer.from("sentry"),
      loginKey: "loginKey",
      machineName: "machineName",
      webNonce: "webNonce",
    },
    data: {} as AccountData,
    state: {} as AccountState,
  };

  step("add()", async () => {
    await SteamAccountsModel.add(steamAccount);
    // attempt to add duplicate
    await assert.rejects(SteamAccountsModel.add(steamAccount), (err: Error) => {
      assert.equal(err.name, "MongoServerError");
      assert.equal(err.message.includes("duplicate key"), true);
      return true;
    });
  });

  step("get()", async () => {
    const sAccount = await SteamAccountsModel.get(steamAccount.userId, steamAccount.username);
    assert.notEqual(sAccount, null);
    // check sentry is decrypted correction
    assert.equal(sAccount.auth.sentry.toString(), steamAccount.auth.sentry.toString());
    assert.equal(sAccount.auth.password, steamAccount.auth.password);
  });

  step("getAll()", async () => {
    const sAccounts = await SteamAccountsModel.getAll(steamAccount.userId);
    assert.equal(sAccounts.length, 1);
    assert.equal((sAccounts[0] as SteamAccount).auth, null);
    assert.equal((sAccounts[0] as SteamAccount).userId, null);
  });

  /*step("update()", async () => {
    steamAccount.auth.sentry = Buffer.from("123");
    steamAccount.auth.password = "123";
    await SteamAccountsModel.update(steamAccount);
    const sAccount = await SteamAccountsModel.get(steamAccount.userId, steamAccount.username);
    assert.equal(sAccount.auth.sentry.toString(), steamAccount.auth.sentry.toString());
    assert.equal(sAccount.auth.password, steamAccount.auth.password);
  });*/

  step("updateField()", async () => {
    steamAccount.auth.sentry = Buffer.from("123");
    await SteamAccountsModel.updateField(steamAccount.userId, steamAccount.username, { auth: steamAccount.auth });

    // validate auth
    const sAccount = await SteamAccountsModel.get(steamAccount.userId, steamAccount.username);
    assert.equal(sAccount.auth.sentry.toString(), steamAccount.auth.sentry.toString());

    // will throw InvalidUpdateFields because attempting to update username or userId
    await assert.rejects(
      SteamAccountsModel.updateField(steamAccount.userId, steamAccount.username, steamAccount),
      (err: Error) => {
        assert.equal(err.name, "steamidler");
        assert.equal(err.message.includes("InvalidUpdateFields"), true);
        return true;
      }
    );
  });

  step("remove()", async () => {
    await SteamAccountsModel.remove(steamAccount.userId, steamAccount.username);
    const sAccount = await SteamAccountsModel.get(steamAccount.userId, steamAccount.username);
    assert.equal(sAccount, null);
  });
});

describe("Model steam-servers", async () => {
  step("fetchSteamServers()", async () => {
    await fetchSteamServers();
  });

  step("getOne()", async () => {
    await getOne();
  });
});

describe("Model steam-verifications", async () => {
  const steamVerify: SteamVerify = {
    userId: "1",
    username: "2",
    proxy: { ip: "123", port: 1 },
    authType: "error",
    createdAt: new Date(),
  };

  step("add()", async () => {
    await SteamVerifyModel.add(steamVerify);
    await assert.rejects(SteamVerifyModel.add(steamVerify), (err: Error) => {
      assert.equal(err.name, "MongoServerError");
      assert.equal(err.message.includes("duplicate key"), true);
      return true;
    });
  });

  step("remove()", async () => {
    await SteamVerifyModel.remove(steamVerify.userId, steamVerify.username);
    await SteamVerifyModel.add(steamVerify);
  });

  it("get()", async () => {
    let sVerify = await SteamVerifyModel.get(steamVerify.userId, steamVerify.username);
    assert.notEqual(sVerify, null);
    assert.equal(sVerify.username, steamVerify.username);
    await SteamVerifyModel.remove(steamVerify.userId, steamVerify.username);
    sVerify = await SteamVerifyModel.get(steamVerify.userId, steamVerify.username);
    assert.equal(sVerify, null);
  });
});

describe("Model users", async () => {
  const user: User = {
    userId: "1",
    nickname: "name",
    email: "email@email.com",
    avatar: "http://avatar.com",
    role: "admin",
    createdAt: new Date(),
    ip: "1.1.1.1",
  };

  step("upsert()", async () => {
    await UserModel.upsert(user);
  });

  step("get()", async () => {
    const userReceived = await UserModel.get(user.userId);
    assert.notEqual(userReceived, null);
    assert.equal(userReceived.avatar, user.avatar);
  });

  step("remove()", async () => {
    await UserModel.remove(user.userId);
    const userReceived = await UserModel.get(user.userId);
    assert.equal(userReceived, null);
  });
});
