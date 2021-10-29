
import path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "../.env") });
import * as mongodb from "./db";
import express from "express";
import userRoutes from "./routes/user";
import SteamAccount from "./routes/SteamAccount";
import SteamAccountAction from "./routes/SteamAccountAction";
import { Db, MongoClient } from "mongodb";
import session from "express-session";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import rateLimiter from "@machiavelli/express-rate-limiter";

const app = express();
const port = 8000;

// Start the app
(async () => {
  console.log("Connecting to DB...");
  const client = await mongodb.connect();
  const db = client.db();

  console.log("Creating collection indexes...");
  await createCollectionIndexes(db);

  console.log("Applying app middleware...");
  appMiddleWare(client);

  console.log("Registering routes...");
  registerRoutes();

  console.log("Starting HTTP server...");
  const res = await startExpress();
  console.log(res);
})();

function startExpress() {
  return new Promise((resolve) => {
    app.listen(port, () => {
      resolve(`\nListening at http://localhost:${port}`);
    });
  });
}

function appMiddleWare(client: MongoClient) {
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: 1048576 })); //1024 kb
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

  // check if logged in, middleware
  app.use((req, res, next) => {
    // skip this route
    if (req.path === "/user/googleresponse" || req.path === "/user/register") {
      return next();
    }

    if (req.session.loggedId) {
      return next();
    }

    return res.status(401).send("not authenticated");
  });

  // rate limit routes
  app.use(
    rateLimiter({
      client,
      excludePaths: ["/steamaccounts", "/user/googleresponse", "/user/register"],
      expireAfterSeconds: 5 * 60,
    })
  );
}

function registerRoutes() {
  app.use("/user", userRoutes);
  app.use("/", SteamAccount);
  app.use("/", SteamAccountAction);
}

async function createCollectionIndexes(db: Db) {
  await db.collection("steam-cms").createIndex({ ip: 1, port: 1 }, { unique: true });
  await db.collection("proxies").createIndex({ ip: 1, port: 1 }, { unique: true });
  await db.collection("proxies").createIndex({ load: 1 });
  await db.collection("users").createIndex({ userId: 1 }, { unique: true });
  await db.collection("invites").createIndex({ email: 1, invite: 1 }, { unique: true });
  await db.collection("steam-accounts").createIndex({ userId: 1, username: 1 }, { unique: true });
  await db.collection("steam-verify").createIndex({ userId: 1, username: 1 }, { unique: true });
}
