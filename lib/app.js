import "dotenv/config";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import rateLimiter from "@machiavelli/express-rate-limiter";
import SteamAccount from "./routes/steamAccount.js";
import SteamAccountAction from "./routes/steamAccountAction.js";
import userRoutes from "./routes/user.js";
import adminTools from "./routes/adminTools.js";
import * as mongodb from "./db.js";
const REQUEST_BODY_SIZE = 1048576; // 1 MB
const app = express();
// Start the app
(async () => {
    console.log("Connecting to DB...");
    const client = await mongodb.connect();
    const db = client.db();
    console.log("Creating collection...");
    await createCollections(db);
    console.log("Applying app middleware...");
    appMiddleWare(client);
    console.log("Registering routes...");
    registerRoutes();
    console.log("Starting HTTP server...");
    const res = await startExpress();
    console.log(res);
})();
/**
 * Creates collections implicitly and indexes
 */
async function createCollections(db) {
    await db.collection("steam-cms").createIndex({ ip: 1, port: 1 }, { unique: true });
    await db.collection("proxies").createIndex({ ip: 1, port: 1 }, { unique: true });
    await db.collection("proxies").createIndex({ load: 1 });
    await db.collection("users").createIndex({ userId: 1 }, { unique: true });
    await db.collection("invites").createIndex({ email: 1, invite: 1 }, { unique: true });
    await db.collection("steam-accounts").createIndex({ userId: 1, username: 1 }, { unique: true });
    await db.collection("steam-verify").createIndex({ userId: 1, username: 1 }, { unique: true });
    await db.collection("steam-verify").createIndex({ createdAt: 1 }, { expireAfterSeconds: 2.5 * 60 });
}
/**
 * Configure Express middleware
 */
function appMiddleWare(client) {
    // handle bad JSON
    const errorHandler = (err, req, res, next) => {
        if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
            return res.status(400).send({ message: err.message }); // Bad request
        }
        return next();
    };
    app.use(errorHandler);
    app.use(express.json({ limit: REQUEST_BODY_SIZE }));
    app.use(cookieParser(process.env.SESSION_SECRET));
    // sessions
    app.use(session({
        name: "session",
        secret: process.env.SESSION_SECRET,
        saveUninitialized: false,
        resave: false,
        cookie: {
            secure: process.env.NODE_ENV === "production" ? true : false,
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
        },
        store: MongoStore.create({
            clientPromise: mongodb.getClient(),
            touchAfter: 24 * 3600,
            ttl: 30 * 24 * 60 * 60 * 1000, // = 30 days
        }),
    }));
    // check for authentication
    app.use((req, res, next) => {
        // skip these routes
        if (req.path === "/api/user/googleresponse" ||
            req.path === "/api/user/register" ||
            req.path === "/api/user/authenticate") {
            return next();
        }
        if (req.session.loggedId) {
            return next();
        }
        return res.status(401).send("not authenticated");
    });
    // rate limit routes
    app.use(rateLimiter({
        client,
        collectionName: "rate-limit",
        customField: { name: "steamAccount", reqBodyProp: "username" },
        excludePaths: ["/user/googleresponse", "/user/register"],
        expireAfterSeconds: 3 * 60,
    }));
}
/**
 * Register Express Routes
 */
function registerRoutes() {
    app.use("/api/", userRoutes);
    app.use("/api/", SteamAccount);
    app.use("/api/", SteamAccountAction);
    app.use("/api/", adminTools);
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
