import "dotenv/config";
import express, { Response, Request, NextFunction } from "express";
import { Db, MongoClient } from "mongodb";
import session from "express-session";
import MongoStore from "connect-mongo";
import rateLimiter from "@machiavelli/express-rate-limiter";
import { mw as requestIp } from "request-ip";
import ms from "ms";

import SteamAccount from "./routes/steamaccount.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import farmer from "./routes/farmer.js";
import SteamClientAction from "./routes/steamclient-actions.js";
import SteamcommunityAction from "./routes/steamcommunity-actions.js";

import * as mongodb from "./db.js";
import { SteamcommunityError } from "steamcommunity-api";
import { SteamClientError } from "steam-client";
import { SteamIdlerError } from "./commons.js";

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
async function createCollections(db: Db) {
  await db.collection("steam-servers").createIndex({ ip: 1, port: 1 }, { unique: true });
  await db.collection("proxies").createIndex({ ip: 1, port: 1 }, { unique: true });
  await db.collection("proxies").createIndex({ load: 1 });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("invites").createIndex({ email: 1 }, { unique: true });
  await db.collection("invites").createIndex({ createdAt: 1 }, { expireAfterSeconds: 30 * 60 });
  await db.collection("steam-accounts").createIndex({ userId: 1, username: 1 }, { unique: true });
  await db.collection("steam-verifications").createIndex({ userId: 1, username: 1 }, { unique: true });
  await db.collection("steam-verifications").createIndex({ createdAt: 1 }, { expireAfterSeconds: 2.5 * 60 });
}

/**
 * Configure Express middleware
 */
function beforeMiddleware(client: MongoClient) {
  app.use(express.json({ limit: REQUEST_BODY_SIZE }));

  // handle bad JSON
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && (err.message.includes("JSON") || "body" in err)) {
      return res.status(400).send({ message: (err as Error).message }); // Bad request
    }
    return next();
  });

  // sessions
  app.use(
    session({
      name: "session",
      secret: process.env.SESSION_SECRET,
      saveUninitialized: false,
      resave: false,
      cookie: {
        secure: process.env.NODE_ENV === "production" ? true : false,
        maxAge: ms("1y"),
        httpOnly: true,
      },
      store: MongoStore.create({
        clientPromise: mongodb.getClient(),
        crypto: { secret: process.env.SESSION_SECRET },
      }),
    })
  );

  // check for authentication
  app.use((req, res, next) => {
    console.log(req.path);
    // skip user paths
    if (["/user/login", "/user/register", "/user/logout"].includes(req.path)) return next();

    if (req.session.userId) return next();

    next(new SteamIdlerError("NotAuthenticated"));
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
  // handle errors
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SteamcommunityError || err instanceof SteamClientError || err instanceof SteamIdlerError) {
      return res.status(400).send({ name: err.name, message: err.message });
    }
    console.log(err);
    return res.status(400).send({ name: err.name, message: err.message });
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
