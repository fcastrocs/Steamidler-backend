import "dotenv/config";
import express, { Response, Request, NextFunction } from "express";
import { Db, MongoClient } from "mongodb";
import rateLimiter from "@machiavelli/express-rate-limiter";
import cookieParser from "cookie-parser";
import cors from "cors";

import userRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import farmer from "./routes/farmer.js";
import SteamClientAction from "./routes/steamclient-actions.js";
import { SteamClientError } from "@machiavelli/steam-client";
import { SteamWebError } from "@machiavelli/steam-web";
import * as SteamAccountController from "./controllers/steam-accounts.js";
import * as steamweb from "./controllers/steamweb.js";

import * as mongodb from "./db.js";
import { setCookie, SteamIdlerError } from "./commons.js";
import { verifyAuth } from "./controllers/auth.js";
import { readFileSync } from "fs";
import http from "http";
import wss from "./websocket.js";

const app = express();
const httpServer = CreateHttpServer();
const WebSocketAPI = new wss();
WebSocketAPI.upgrade(httpServer);

const REQUEST_BODY_SIZE = 1048576; // 1 MB

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
  registerWebSocketRoutes();

  console.log("Applying after middleware...");
  afterMiddleWare();

  console.log("\nREADY\n");
})();

/**
 * Creates collections implicitly and indexes
 */
async function createCollections(db: Db) {
  await db.collection("steam-servers").createIndex(["ip", "port"], { unique: true });

  await db.collection("proxies").createIndex(["ip", "port"], { unique: true });
  await db.collection("proxies").createIndex("load");

  await db.collection("users").createIndex("email", { unique: true });

  await db.collection("invites").createIndex("email", { unique: true });
  await db.collection("invites").createIndex(["email", "code"], { unique: true });
  await db.collection("invites").createIndex("createdAt", { expireAfterSeconds: 30 * 60 });

  await db.collection("steam-accounts").createIndex(["userId", "accountName"], { unique: true });

  await db.collection("refresh-tokens").createIndex("userId", { unique: true });
  await db.collection("refresh-tokens").createIndex(["userId", "token"], { unique: true });
}

/**
 * Express before-Middleware
 */
function beforeMiddleware(client: MongoClient) {
  app.use(
    cors({
      origin: "http://steamidler.com",
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: REQUEST_BODY_SIZE }));

  // handle bad JSON
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && (err.message.includes("JSON") || "body" in err)) {
      return res.status(400).send({ message: (err as Error).message }); // Bad request
    }
    return next();
  });

  // check for authentication
  app.use(async (req, res, next) => {
    // skip user paths
    if (["/user/login", "/user/register"].includes(req.path)) return next();

    // skip admin paths
    if (req.path.includes("/admin/")) return next();

    if (!req.cookies || !req.cookies["access-token"] || !req.cookies["refresh-token"]) {
      const error = new SteamIdlerError("NotAuthenticated");
      return res.status(401).send({ name: error.name, message: error.message });
    }

    try {
      const auth = await verifyAuth(req.cookies["access-token"], req.cookies["refresh-token"]);
      req.body.userId = auth.userId;
      // access-token was renewed, set cookie again
      if (auth.accessToken) setCookie("access-token", auth.accessToken, res);
      return next();
    } catch (error) {
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
}

/**
 * Register Express Routes
 */
function registerRoutes() {
  app.use("/", adminRoutes);
  app.use("/", userRoutes);
  app.use("/", SteamClientAction);
  app.use("/", farmer);
}

function registerWebSocketRoutes() {
  WebSocketAPI.addRoute("steamaccount/add", SteamAccountController.add);
  WebSocketAPI.addRoute("steamaccount/login", SteamAccountController.login);
  WebSocketAPI.addRoute("steamaccount/logout", SteamAccountController.logout);
  WebSocketAPI.addRoute("steamaccount/authrenew", SteamAccountController.authRenew);
  WebSocketAPI.addRoute("steamaccount/remove", SteamAccountController.remove);
  WebSocketAPI.addRoute("steamaccount/updateWithSteamGuardCode", SteamAccountController.updateWithSteamGuardCode);

  WebSocketAPI.addRoute("steamweb/changeavatar", steamweb.changeAvatar);
  WebSocketAPI.addRoute("steamweb/clearaliases", steamweb.clearAliases);
  WebSocketAPI.addRoute("steamweb/changeprivacy", steamweb.changePrivacy);
}

/**
 * Express after-Middleware
 */
function afterMiddleWare() {
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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

function CreateHttpServer() {
  const port = process.env.PORT || 8000;

  return http.createServer(app).listen(port, () => {
    console.log(`HTTP server is running at port ${port}`);
  });
}
