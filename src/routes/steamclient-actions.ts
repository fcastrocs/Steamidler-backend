import { Router } from "express";
const router = Router();
import * as SteamClientAction from "../controllers/steamclient-actions.js";

const ROUTE = "/steamaccount/action/";

/**
 * Idle steam games
 * @route
 */
router.post(ROUTE + "idlegames", async (req, res) => {
  const username = req.body.username;
  const appids: number[] = req.body.appids;

  if (!username || !appids) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  if (!Array.isArray(appids)) {
    res.statusMessage = "appids must be an array";
    return res.status(400).send(res.statusMessage);
  }

  if (appids.some((i) => !Number.isInteger(i))) {
    res.statusMessage = "appids must be an integer array";
    return res.status(400).send(res.statusMessage);
  }

  if (appids.length > 32) {
    res.statusMessage = "only 32 games are allowed per game";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await SteamClientAction.idleGames(req.session.userId, username, appids);
  } catch (error) {
    console.error(error);
    res.statusMessage = error;
    return res.status(400).send(error);
  }
  return res.send();
});

/**
 * Change nickname
 * @route
 */
router.post(ROUTE + "changenick", async (req, res) => {
  const username = req.body.username;
  const nick = req.body.nick;

  if (!username || !nick) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  if (typeof nick !== "string") {
    res.statusMessage = "nick must be a string";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await SteamClientAction.changeNick(req.session.userId, username, nick);
  } catch (error) {
    console.error(error);
    res.statusMessage = error;
    return res.status(400).send(res.statusMessage);
  }
  return res.send();
});

/**
 * Activate free to play game
 * @route
 */
router.post(ROUTE + "activatef2pgames", async (req, res) => {
  const username = req.body.username;
  const appids = req.body.appids;

  if (!username || !appids) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  if (!Array.isArray(appids)) {
    res.statusMessage = "appids must be an array";
    return res.status(400).send(res.statusMessage);
  }

  if (appids.some((i) => !Number.isInteger(i))) {
    res.statusMessage = "appids must be an integer array";
    return res.status(400).send(res.statusMessage);
  }

  try {
    const games = await SteamClientAction.activatef2pgame(req.session.userId, username, appids);
    return res.send(games);
  } catch (error) {
    console.error(error);
    res.statusMessage = error;
    return res.status(400).send(error);
  }
});

/**
 * Redeem game cdkey
 * @route
 */
router.post(ROUTE + "cdkeyredeem", async (req, res) => {
  const username = req.body.username;
  const cdkey = req.body.cdkey;

  if (!username || !cdkey) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  try {
    const games = await SteamClientAction.cdkeyRedeem(req.session.userId, username, cdkey);
    return res.send(games);
  } catch (error) {
    console.error(error);
    res.statusMessage = error;
    return res.status(400).send(error);
  }
});

export default router;
