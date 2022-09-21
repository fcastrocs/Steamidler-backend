import "dotenv/config";
import express from "express";
import { ObjectId } from "mongodb";
import { mw as requestIp } from "request-ip";
import cookieParser from "cookie-parser";
import SteamAccount from "./routes/steamaccount.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import farmer from "./routes/farmer.js";
import SteamClientAction from "./routes/steamclient-actions.js";
import SteamcommunityAction from "./routes/steamcommunity-actions.js";
import { SteamClientError } from "@machiavelli/steam-client";
import { SteamWebError } from "@machiavelli/steam-web";
import * as mongodb from "./db.js";
import { setCookie, SteamIdlerError } from "./commons.js";
import { verifyAuth } from "./controllers/users.js";
const REQUEST_BODY_SIZE = 1048576; // 1 MB
const app = express();
// Start the app
(async () => {
    console.log("Connecting to DB...");
    const client = await mongodb.connect();
    const db = client.db();
    console.log("Creating collection...");
    await createCollections(db);
    console.log("Applying before middleware...");
    beforeMiddleware(client);
    console.log("Registering routes...");
    registerRoutes();
    console.log("Applying after middleware...");
    afterMiddleWare();
    console.log("Starting HTTP server...");
    const res = await startExpress();
    console.log(res);
})();
/**
 * Creates collections implicitly and indexes
 */
async function createCollections(db) {
    await db.collection("steam-servers").createIndex(["ip", "port"], { unique: true });
    await db.collection("proxies").createIndex(["ip", "port"], { unique: true });
    await db.collection("proxies").createIndex("load");
    await db.collection("users").createIndex("email", { unique: true });
    await db.collection("invites").createIndex("email", { unique: true });
    await db.collection("invites").createIndex(["email", "code"], { unique: true });
    await db.collection("invites").createIndex("createdAt", { expireAfterSeconds: 30 * 60 });
    await db.collection("steam-accounts").createIndex(["userId", "username"], { unique: true });
    await db.collection("refresh-tokens").createIndex("userId", { unique: true });
    await db.collection("refresh-tokens").createIndex(["userId", "token"], { unique: true });
    await db.collection("steam-verifications").createIndex("userId", { unique: true });
    await db.collection("steam-verifications").createIndex(["userId", "username"], { unique: true });
    await db.collection("steam-verifications").createIndex("createdAt", { expireAfterSeconds: 2.5 * 60 });
}
/**
 * Configure Express middleware
 */
function beforeMiddleware(client) {
    app.use(cookieParser());
    app.use(express.json({ limit: REQUEST_BODY_SIZE }));
    // handle bad JSON
    app.use((err, req, res, next) => {
        if (err instanceof SyntaxError && (err.message.includes("JSON") || "body" in err)) {
            return res.status(400).send({ message: err.message }); // Bad request
        }
        return next();
    });
    // check for authentication
    app.use(async (req, res, next) => {
        // skip user paths
        if (["/user/login", "/user/register"].includes(req.path))
            return next();
        // skip admin paths
        if (req.path.includes("/admin/"))
            return next();
        if (!req.cookies || !req.cookies["access-jwt"] || !req.cookies["refresh-token"]) {
            const error = new SteamIdlerError("NotAuthenticated");
            return res.status(401).send({ name: error.name, message: error.message });
        }
        try {
            const { user, accessJWT } = await verifyAuth(req.cookies["access-jwt"], req.cookies["refresh-token"]);
            req.body.userId = new ObjectId(user._id);
            // accessJWT was renewed, set cookie again
            if (accessJWT)
                setCookie("access-jwt", accessJWT, res);
            return next();
        }
        catch (error) {
            return res.status(401).send({ name: error.name, message: error.message });
        }
    });
    // rate limit routes
    // app.use(
    //   rateLimiter({
    //     client,
    //     collectionName: "rate-limit",
    //     customField: { name: "steamAccount", reqBodyProp: "username" },
    //     excludePaths: ["/user/googleresponse", "/user/register"],
    //     expireAfterSeconds: 3 * 60,
    //   })
    // );
    // request IP
    app.use(requestIp());
}
/**
 * Register Express Routes
 */
function registerRoutes() {
    app.use("/", adminRoutes);
    app.use("/", userRoutes);
    app.use("/", SteamAccount);
    app.use("/", SteamClientAction);
    app.use("/", SteamcommunityAction);
    app.use("/", farmer);
}
function afterMiddleWare() {
    app.use((err, req, res, next) => {
        if (err) {
            console.log(err);
            // handle errors
            if (err instanceof SteamWebError || err instanceof SteamClientError || err instanceof SteamIdlerError) {
                return res.status(400).send({ name: err.name, message: err.message });
            }
            return res.status(400).send({ name: err.name, message: err.message });
        }
        return next();
    });
}
/**
 * Start Express
 */
function startExpress() {
    const port = process.env.NODE_ENV === "production" ? process.env.PORT : 8000;
    return new Promise((resolve) => {
        app.listen(port, () => {
            resolve(`\nListening at http://localhost:${port}`);
        });
    });
}
