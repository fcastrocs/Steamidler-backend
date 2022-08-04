import express, { NextFunction, Request as Req, Response as Res, Router } from "express";
import * as ProxyModel from "../models/proxies.js";
import { fetchSteamServers } from "../models/steam-servers.js";
const router = Router();

const ROUTE = "/admintools";

/**
 * Middleware to check admin rights
 */
function isAdmin(req: Req, res: Res, next: NextFunction) {
  if (process.env.NODE_ENV === "production") {
    if (!req.session.isAdmin) {
      return res.sendStatus(404);
    }
  }
  return next();
}

/**
 * Add proxies
 */
router.post(ROUTE + "/addproxies", [isAdmin, express.text()], async (req: Req, res: Res) => {
  const proxies = req.body;

  if (!proxies || typeof proxies !== "string") {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  const array = proxies.split(/\r?\n/);

  if (!array.length) {
    res.statusMessage = "No proxies specified.";
    return res.status(400).send(res.statusMessage);
  }

  try {
    const insertedCount = await ProxyModel.add(array);
    return res.send(`Inserted ${insertedCount} proxies`);
  } catch (error) {
    res.statusMessage = error;
    return res.status(400).send(error);
  }
});

router.post(ROUTE + "/fetchSteamServers", isAdmin, async (req: Req, res: Res) => {
  try {
    await fetchSteamServers();
  } catch (error) {
    res.statusMessage = error;
    return res.status(400).send(error);
  }
  return res.send();
});

export default router;
