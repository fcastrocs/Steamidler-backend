import "dotenv/config";
import assert from "assert";
import * as ProxyModel from "../models/proxies.js";
import * as InvitesModel from "../models/invites.js";
import * as SteamServersModel from "../models/steam-servers.js";
import * as SteamVerifyModel from "../models/steam-verifications.js";
import * as SteamAccountsModel from "../models/steam-accounts.js";
import SteamStore from "../models/steam-store.js";
import * as UsersModel from "../models/users.js";
import { ObjectId } from "mongodb";
describe("Model invites", async () => {
    const email = "email@gmail.com";
    let code = "";
    step("add()", async () => {
        code = await InvitesModel.add(email);
        assert.equal(code.length === 16, true);
        // try to insert duplicate
        await assert.rejects(InvitesModel.add(email), (err) => {
            assert.equal(err.name, "steamidler");
            assert.equal(err.message, "Exists");
            return true;
        });
    });
    step("exists()", async () => {
        const invite = await InvitesModel.exits(email, code);
        assert.equal(invite, true);
    });
    it("remove()", async () => {
        await InvitesModel.remove(email);
        const exists = await InvitesModel.exits(email, code);
        assert.equal(exists, false);
    });
});
describe("Model proxies", async () => {
    process.env.PROXY_LOAD_LIMIT = "1";
    const ip = "185.242.110.74";
    const port = 12324;
    step("add()", async () => {
        // try to add duplicate
        const count = await ProxyModel.add([`${ip}:${port}`]);
        assert.equal(count, 1);
        await assert.rejects(ProxyModel.add(["123"]), (err) => {
            assert.equal(err.name, "steamidler");
            assert.equal(err.message, "ProxyNotValid");
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
        await assert.rejects(ProxyModel.getOne(), (err) => {
            assert.equal(err.name, "steamidler");
            assert.equal(err.message, "ProxyLimitReached");
            return true;
        });
        await ProxyModel.decreaseLoad({ ip, port });
        await ProxyModel.getOne();
    });
    it("remove()", async () => {
        await ProxyModel.remove({ ip, port });
        await assert.rejects(ProxyModel.getOne(), (err) => {
            assert.equal(err.name, "steamidler");
            assert.equal(err.message, "ProxyLimitReached");
            return true;
        });
    });
});
describe("Model steam-accounts", async () => {
    const steamAccount = {
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
        data: {},
        state: {},
    };
    step("add()", async () => {
        await SteamAccountsModel.add(steamAccount);
        // attempt to add duplicate
        await assert.rejects(SteamAccountsModel.add(steamAccount), (err) => {
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
        await assert.rejects(SteamAccountsModel.updateField(steamAccount.userId, steamAccount.username, steamAccount), (err) => {
            assert.equal(err.name, "steamidler");
            assert.equal(err.message.includes("InvalidUpdateFields"), true);
            return true;
        });
    });
    step("remove()", async () => {
        await SteamAccountsModel.remove(steamAccount.userId, steamAccount.username);
        const sAccount = await SteamAccountsModel.get(steamAccount.userId, steamAccount.username);
        assert.equal(sAccount, null);
    });
});
describe("Model steam-servers", async () => {
    step("renew()", async () => {
        await SteamServersModel.renew();
    });
    step("getOne()", async () => {
        await SteamServersModel.getOne();
    });
});
describe("Model steam-store", () => {
    const userId = "1";
    const username = "username";
    const steam = {};
    const steam2 = {};
    step("add()", async () => {
        SteamStore.add(userId, username, steam);
        SteamStore.add(userId, username + 1, steam2);
        // try to add duplicate
        assert.throws(function () {
            SteamStore.add(userId, username + 1, steam2);
        }, { message: "Exists", name: "steamidler" });
        assert.throws(function () {
            SteamStore.add(userId, username, steam);
        }, { message: "Exists", name: "steamidler" });
    });
    step("has()", async () => {
        assert.equal(SteamStore.has(userId, username), true);
        assert.equal(SteamStore.has(userId, username + 1), true);
        assert.equal(SteamStore.has(userId, username + 2), false);
    });
    step("get()", async () => {
        assert.notEqual(SteamStore.get(userId, username), null);
        assert.notEqual(SteamStore.get(userId, username + 1), null);
        assert.equal(SteamStore.get(userId, username + 2), null);
        assert.equal(SteamStore.get(userId + 1, username + 2), null);
    });
    step("remove()", async () => {
        assert.notEqual(SteamStore.remove(userId, username), null);
        assert.notEqual(SteamStore.remove(userId, username + 1), null);
        assert.equal(SteamStore.remove(userId, username + 2), null);
        assert.equal(SteamStore.remove(userId + 1, username + 2), null);
    });
});
describe("Model steam-verifications", async () => {
    const steamVerify = {
        userId: "1",
        username: "2",
        proxy: { ip: "123", port: 1 },
        authType: "error",
        createdAt: new Date(),
    };
    step("add()", async () => {
        await SteamVerifyModel.add(steamVerify);
        await assert.rejects(SteamVerifyModel.add(steamVerify), (err) => {
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
    const user = {
        _id: new ObjectId(),
        email: "email@email.com",
        password: "12345@",
        createdAt: new Date(),
        ip: "1.1.1.1",
    };
    step("add()", async () => {
        await UsersModel.add(user);
    });
    step("get()", async () => {
        const userReceived = await UsersModel.get(user.email);
        assert.notEqual(userReceived, null);
        assert.equal(userReceived.email, user.email);
    });
    step("remove()", async () => {
        await UsersModel.remove(user.email);
        const userReceived = await UsersModel.get(user.email);
        assert.equal(userReceived, null);
    });
});
