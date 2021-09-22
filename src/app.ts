import path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "../.env") });
import cors from "cors";
import cookieParser from "cookie-parser";

import * as mongodb from "./db";

import { fetchSteamCms } from "./models/steamcm";
import { fetchProxies } from "./models/proxy";

import express from "express";
import userRoutes from "./routes/user";

const app = express();
const port = 8000;

// Start the app
(async () => {
  console.log("Connecting to DB.");
  const client = await mongodb.connect();
  const db = client.db();

  console.log("Creating collection indexes.");
  db.collection("steam-accounts").createIndex(
    { accountName: 1 },
    { unique: true }
  );
  db.collection("steam-cms").createIndex({ ip: 1, port: 1 }, { unique: true });
  db.collection("proxies").createIndex({ ip: 1, port: 1 }, { unique: true });
  db.collection("users").createIndex({ userId: 1 }, { unique: true });
  db.collection("invites").createIndex(
    { email: 1, invite: 1 },
    { unique: true }
  );

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
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cors());
  app.use("/user", userRoutes);
}
