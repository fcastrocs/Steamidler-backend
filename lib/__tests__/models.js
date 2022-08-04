import assert from "assert";
import "dotenv/config";
import { addProxies, decreaseLoad, deleteProxy, getOneProxy, increaseLoad } from "../models/proxies.js";
import { createInvite, inviteExists, removeInvite } from "../models/invites.js";
import { fetchSteamServers, getOne } from "../models/steam-servers.js";
import * as SteamVerifyModel from "../models/steam-verify.js";
import * as UserModel from "../models/users.js";
describe("Model invites", async () => {
    const email = "email@gmail.com";
    let code = "";
    step("create()", async () => {
        code = await createInvite(email);
        assert.equal(code.length === 16, true);
        // try to insert duplicate
        await assert.rejects(createInvite(email), (err) => {
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
        await assert.rejects(addProxies(["123"]), (err) => {
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
        await assert.rejects(getOneProxy(), (err) => {
            assert.equal(err.name, "steamidler");
            assert.equal(err.message, "ProxyLimitReached");
            return true;
        });
        await decreaseLoad({ ip, port });
        await getOneProxy();
    });
    it("deleteProxy()", async () => {
        await deleteProxy({ ip, port });
        await assert.rejects(getOneProxy(), (err) => {
            assert.equal(err.name, "steamidler");
            assert.equal(err.message, "ProxyLimitReached");
            return true;
        });
    });
});
describe("Model steam-accounts", async () => {
    //
});
describe("Model steam-servers", async () => {
    step("fetchSteamServers()", async () => {
        await fetchSteamServers();
    });
    step("getOne()", async () => {
        await getOne();
    });
});
describe("Model steam-verify", async () => {
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
