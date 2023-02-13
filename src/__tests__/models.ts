import "dotenv/config";
import assert from "assert";
import * as ProxyModel from "../models/proxies.js";
import * as InvitesModel from "../models/invites.js";
import * as SteamServersModel from "../models/steam-servers.js";
import { AccountState, RefreshToken, SteamAccount, SteamVerify, User } from "../../@types/index.js";
import * as SteamVerifyModel from "../models/steam-verifications.js";
import * as SteamAccountsModel from "../models/steam-accounts.js";
import SteamStore from "../models/steam-store.js";
const steamStore = new SteamStore();
import * as UsersModel from "../models/users.js";
import * as RefreshTokensModel from "../models/refresh-tokens.js";
import { ObjectId } from "mongodb";
import Steam, { AccountData } from "@machiavelli/steam-client";

describe("Model invites", async () => {
  const email = "email@gmail.com";
  let code = "";

  step("add()", async () => {
    code = await InvitesModel.add(email);
    assert.equal(code.length === 16, true);
    // try to insert duplicates
    await assert.rejects(InvitesModel.add(email), (err: Error) => {
      assert.equal(err.name, "MongoServerError");
      assert.equal(err.message.includes("E11000"), true);
      return true;
    });
  });

  step("exists()", async () => {
    let exists = await InvitesModel.exits({ email, code });
    assert.equal(exists, true);
    exists = await InvitesModel.exits({ email, code: "code" });
    assert.equal(exists, false);
  });

  it("remove()", async () => {
    await InvitesModel.remove(email);
    const exists = await InvitesModel.exits({ email, code });
    assert.equal(exists, false);
  });
});

describe("Model proxies", async () => {
  process.env.PROXY_LOAD_LIMIT = "1";
  const ip = "185.242.110.74";
  const port = 12324;

  step("add()", async () => {
    const count = await ProxyModel.add([`${ip}:${port}`]);
    assert.equal(count, 1);
    // try to add invalid proxy
    await assert.rejects(ProxyModel.add(["123"]), (err: Error) => {
      assert.equal(err.name, "steamidler");
      assert.equal(err.message, "ProxyNotValid");
      return true;
    });

    // try to add duplicate
    await assert.rejects(ProxyModel.add([`${ip}:${port}`]), (err: Error) => {
      assert.equal(err.name, "MongoBulkWriteError");
      assert.equal(err.message.includes("E11000"), true);
      return true;
    });
  });

  step("increaseLoad()", async () => {
    let modified = await ProxyModel.increaseLoad({ ip, port });
    assert.equal(modified, true);
    modified = await ProxyModel.increaseLoad({ ip, port });
    assert.equal(modified, false);
  });

  step("decreaseLoad()", async () => {
    let modified = await ProxyModel.decreaseLoad({ ip, port });
    assert.equal(modified, true);
    modified = await ProxyModel.decreaseLoad({ ip, port });
    assert.equal(modified, false);
  });

  step("getOne()", async () => {
    await ProxyModel.getOne();
    await ProxyModel.increaseLoad({ ip, port });
    await assert.rejects(ProxyModel.getOne(), (err: Error) => {
      assert.equal(err.name, "steamidler");
      assert.equal(err.message, "ProxyLimitReached");
      return true;
    });
    await ProxyModel.decreaseLoad({ ip, port });
    await ProxyModel.getOne();
  });

  it("remove()", async () => {
    await ProxyModel.remove({ ip, port });
    await assert.rejects(ProxyModel.getOne(), (err: Error) => {
      assert.equal(err.name, "steamidler");
      assert.equal(err.message, "ProxyLimitReached");
      return true;
    });
  });
});

// describe("Model steam-accounts", async () => {
//   const steamAccount: SteamAccount = {
//     userId: new ObjectId(),
//     accountName: "username",
//     auth: {
//       password: "password",
//       cookie: { sessionid: "sessionId", steamLoginSecure: "steamLoginSecure" },
//       type: "email",
//       sentry: Buffer.from("sentry"),
//       loginKey: "loginKey",
//       machineName: "machineName",
//       webNonce: "webNonce",
//     },
//     data: {} as AccountData,
//     state: {} as AccountState,
//   };

//   step("add()", async () => {
//     await SteamAccountsModel.add(steamAccount);
//     // attempt to add duplicate
//     await assert.rejects(SteamAccountsModel.add(steamAccount), (err: Error) => {
//       assert.equal(err.name, "MongoServerError");
//       assert.equal(err.message.includes("duplicate key"), true);
//       return true;
//     });
//   });

//   step("get()", async () => {
//     const sAccount = await SteamAccountsModel.get(steamAccount.userId, steamAccount.accountName);
//     assert.notEqual(sAccount, null);
//     // check sentry is decrypted correction
//     assert.equal(sAccount.auth.sentry.toString(), steamAccount.auth.sentry.toString());
//     assert.equal(sAccount.auth.password, steamAccount.auth.password);
//   });

//   /*step("update()", async () => {
//     steamAccount.auth.sentry = Buffer.from("123");
//     steamAccount.auth.password = "123";
//     await SteamAccountsModel.update(steamAccount);
//     const sAccount = await SteamAccountsModel.get(steamAccount.userId, steamAccount.username);
//     assert.equal(sAccount.auth.sentry.toString(), steamAccount.auth.sentry.toString());
//     assert.equal(sAccount.auth.password, steamAccount.auth.password);
//   });*/

//   step("updateField()", async () => {
//     steamAccount.auth.sentry = Buffer.from("123");
//     await SteamAccountsModel.updateField(steamAccount.userId, steamAccount.accountName, { auth: steamAccount.auth });

//     // validate auth
//     const sAccount = await SteamAccountsModel.get(steamAccount.userId, steamAccount.accountName);
//     assert.equal(sAccount.auth.sentry.toString(), steamAccount.auth.sentry.toString());

//     // will throw InvalidUpdateFields because attempting to update username or userId
//     await assert.rejects(
//       SteamAccountsModel.updateField(steamAccount.userId, steamAccount.accountName, steamAccount),
//       (err: Error) => {
//         assert.equal(err.name, "steamidler");
//         assert.equal(err.message.includes("InvalidUpdateFields"), true);
//         return true;
//       }
//     );
//   });

//   step("remove()", async () => {
//     await SteamAccountsModel.remove(steamAccount.userId, steamAccount.accountName);
//     const sAccount = await SteamAccountsModel.get(steamAccount.userId, steamAccount.accountName);
//     assert.equal(sAccount, null);
//   });
// });

describe("Model steam-servers", async () => {
  step("renew()", async () => {
    await SteamServersModel.renew();
  });

  step("getOne()", async () => {
    await SteamServersModel.getOne();
  });
});

describe("Model steam-store", () => {
  const userId = new ObjectId();
  const userId2 = new ObjectId();
  const username = "username";
  const steam: Steam = {} as Steam;
  const steam2: Steam = {} as Steam;

  step("add()", async () => {
    steamStore.add(userId, username, steam);
    steamStore.add(userId, username + 1, steam2);
    // try to add duplicate
    assert.throws(() => steamStore.add(userId, username + 1, steam2), { message: "Exists", name: "steamidler" });
    assert.throws(() => steamStore.add(userId, username, steam), { message: "Exists", name: "steamidler" });
  });

  step("get()", async () => {
    assert.equal(steamStore.get(userId, username), steam);
    assert.equal(steamStore.get(userId, username + 1), steam2);
    assert.notEqual(steamStore.get(userId, username), steam2);
    assert.equal(steamStore.get(userId, username + 2), null);
    assert.equal(steamStore.get(userId2, username + 2), null);
  });

  step("remove()", async () => {
    assert.equal(steamStore.remove(userId, username), steam);
    assert.equal(steamStore.remove(userId, username + 1), steam2);
    assert.equal(steamStore.remove(userId, username + 2), null);
    assert.equal(steamStore.remove(userId2, username + 2), null);
  });
});

describe("Model steam-verifications", async () => {
  const steamVerify: SteamVerify = {
    userId: new ObjectId(),
    username: "username",
    proxy: { ip: "123", port: 1 },
    authType: "error",
    createdAt: new Date(),
  };

  step("add()", async () => {
    await SteamVerifyModel.add(steamVerify);
    // try to add duplicate
    await assert.rejects(SteamVerifyModel.add(steamVerify), (err: Error) => {
      assert.equal(err.name, "MongoServerError");
      assert.equal(err.message.includes("E11000"), true);
      return true;
    });
  });

  step("remove()", async () => {
    assert.equal(await SteamVerifyModel.remove(steamVerify.userId), true);
    assert.equal(await SteamVerifyModel.remove(steamVerify.userId), false);
  });

  it("get()", async () => {
    await SteamVerifyModel.add(steamVerify);
    assert.notEqual(await SteamVerifyModel.get(steamVerify.userId), null);
    await SteamVerifyModel.remove(steamVerify.userId);
    assert.equal(await SteamVerifyModel.get(steamVerify.userId), null);
  });
});

describe("Model users", async () => {
  const user: User = {
    username: "machiavelli",
    _id: new ObjectId(),
    email: "email@email.com",
    password: "12345@",
    createdAt: new Date(),
    ip: "1.1.1.1",
  };

  step("add()", async () => {
    await UsersModel.add(user);
    // try to add duplicate
    await assert.rejects(UsersModel.add(user), (err: Error) => {
      assert.equal(err.name, "MongoServerError");
      assert.equal(err.message.includes("E11000"), true);
      return true;
    });
  });

  step("get()", async () => {
    const userReceived = await UsersModel.get({ email: user.email });
    assert.notEqual(userReceived, null);
    assert.equal(userReceived.email, user.email);
  });

  step("remove()", async () => {
    await UsersModel.remove(user.email);
    const userReceived = await UsersModel.get({ email: user.email });
    assert.equal(userReceived, null);
  });
});

describe("Model refresh-tokens", async () => {
  const refreshToken: RefreshToken = {
    userId: new ObjectId(),
    token: "123",
  };

  step("upsert()", async () => {
    await RefreshTokensModel.upsert(refreshToken);
    // try to add duplicate
    await RefreshTokensModel.upsert({ userId: refreshToken.userId, token: "321" });
  });

  step("has()", async () => {
    assert.equal(await RefreshTokensModel.has(refreshToken), false);
    assert.equal(await RefreshTokensModel.has({ userId: refreshToken.userId, token: "321" }), true);
  });

  step("remove()", async () => {
    assert.equal(await RefreshTokensModel.remove(refreshToken.userId), true);
    assert.equal(await RefreshTokensModel.has({ userId: refreshToken.userId, token: "321" }), false);
  });
});
