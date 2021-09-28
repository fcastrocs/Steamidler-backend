import path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "../.env") });

import * as mongodb from "./db";

import { fetchSteamCms } from "./models/steamcm";
import { fetchProxies } from "./models/proxy";

import express from "express";
import userRoutes from "./routes/user";
import steamAccountRoutes from "./routes/steamaccount";
import { Db } from "mongodb";

import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";

const app = express();
const port = 8000;

// Start the app
(async () => {
  console.log("Connecting to DB.");
  const client = await mongodb.connect();
  const db = client.db();

  console.log("Creating collection indexes.");
  await createCollectionIndexes(db);

  console.log("Fetching proxies...");
  await fetchProxies();

  console.log("Fetchings steamcms...");
  await fetchSteamCms();

  console.log("Applying app middleware...");
  appMiddleWare();

  console.log("Starting HTTP server...");
  const res = await startExpress();
  console.log(res);
})();

function startExpress() {
  return new Promise((resolve) => {
    app.listen(port, () => {
      resolve(`Listening at http://localhost:${port}`);
    });
  });
}

function appMiddleWare() {
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use(cookieParser(process.env.SESSION_SECRET, {}));

  // sessions
  app.use(
    session({
      name: "session",
      secret: process.env.SESSION_SECRET,
      saveUninitialized: false,
      resave: false,
      cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false },
      store: MongoStore.create({
        clientPromise: mongodb.getClient(),
        touchAfter: 24 * 3600,
        ttl: 30 * 24 * 60 * 60 * 1000, // = 30 days
      }),
    })
  );

  // logged in
  app.use((req, res, next) => {
    if (req.path === "/user/login" && req.method === "POST") {
      return next();
    }

    if (req.session.loggedId) {
      return next();
    }

    return res.sendStatus(401);
  });

  app.use("/user", userRoutes);
  app.use("/steamaccount", steamAccountRoutes);
}

async function createCollectionIndexes(db: Db) {
  await db.collection("steam-accounts").createIndex({ accountName: 1 }, { unique: true });
  await db.collection("steam-cms").createIndex({ ip: 1, port: 1 }, { unique: true });
  await db.collection("proxies").createIndex({ ip: 1, port: 1 }, { unique: true });
  await db.collection("users").createIndex({ userId: 1 }, { unique: true });
  await db.collection("invites").createIndex({ email: 1, invite: 1 }, { unique: true });
  await db.collection("steam-accounts").createIndex({ userId: 1, username: 1 }, { unique: true });
  await db.collection("steam-verify").createIndex({ userId: 1, username: 1 }, { unique: true });
  await db.collection("auto-login").createIndex({ userId: 1, username: 1 }, { unique: true });
}
