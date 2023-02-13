import "dotenv/config";
import express, { Response, Request, NextFunction } from "express";
import { Db, MongoClient } from "mongodb";
import rateLimiter from "@machiavelli/express-rate-limiter";
import cookieParser from "cookie-parser";
import cors from "cors";

import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import farmer from "./routes/farmer.js";
import index from "./routes/index.js";
import SteamClientAction from "./routes/steamclient-actions.js";
import { SteamClientError } from "@machiavelli/steam-client";
import { SteamWebError } from "@machiavelli/steam-web";
import * as SteamAccountController from "./controllers/steam-accounts.js";
import * as steamweb from "./controllers/steamweb.js";

const steamStore = new SteamStore();
const steamTempStore = new SteamStore();

import * as mongodb from "./db.js";
import { SteamIdlerError } from "./commons.js";
import http from "http";
import WebSocketServer from "./websocket-server.js";
import SteamStore from "./models/steam-store.js";

const app = express();
const httpServer = CreateHttpServer();
const wsServer = new WebSocketServer();
wsServer.upgrade(httpServer);

export { wsServer, steamStore, steamTempStore };

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
  // cors
  app.use(
    cors({
      origin: process.env.ORIGIN || "http://localhost:3000",
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: REQUEST_BODY_SIZE }));

  // handle bad JSON
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && (err.message.includes("JSON") || "body" in err)) {
      return res.status(400).send({ message: (err as Error).message });
    }
    return next();
  });

  // check for authentication
  app.use(async (req, res, next) => {
    // skip user paths
    if (["/user/login", "/user/register", "user/verifyauth"].includes(req.path)) return next();

    // skip admin paths, for now ...
    if (req.path.includes("/admin/")) return next();

    app.post("/user/verifyAuth");
    next();
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

function registerRoutes() {
  app.use("/", index);
  app.use("/", adminRoutes);
  app.use("/", userRoutes);
  app.use("/", SteamClientAction);
  app.use("/", farmer);

  wsServer.addRoute("steamaccount/get", SteamAccountController.get);
  wsServer.addRoute("steamaccount/getall", SteamAccountController.getAll);
  wsServer.addRoute("steamaccount/add", SteamAccountController.add);
  wsServer.addRoute("steamaccount/login", SteamAccountController.login);
  wsServer.addRoute("steamaccount/logout", SteamAccountController.logout);
  wsServer.addRoute("steamaccount/authrenew", SteamAccountController.authRenew);
  wsServer.addRoute("steamaccount/remove", SteamAccountController.remove);
  wsServer.addRoute("steamaccount/updateWithSteamGuardCode", SteamAccountController.updateWithSteamGuardCode);

  wsServer.addRoute("steamweb/changeavatar", steamweb.changeAvatar);
  wsServer.addRoute("steamweb/clearaliases", steamweb.clearAliases);
  wsServer.addRoute("steamweb/changeprivacy", steamweb.changePrivacy);
}

/**
 * Express after-Middleware
 */
function afterMiddleWare() {
  // catch exceptions
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err) {
      console.log(err);

      // excepted exceptions
      if (err instanceof SteamWebError || err instanceof SteamClientError || err instanceof SteamIdlerError) {
        return res.status(400).send({ name: err.name, message: err.message });
      }

      // unexpected exceptions
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
