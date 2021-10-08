import { Router } from "express";
import multer from "multer";
const upload = multer();
import * as SteamAccountAction from "../controllers/SteamAccountAction";
const router = Router();

const ROUTE = "/steamaccount/action/";

router.post(ROUTE + "idlegames", async (req, res) => {
  const username = req.body.username;
  const appids = req.body.appids;

  if (!username || !appids) {
    return res.status(400).send("username and appids fields required.");
  }

  if (!Array.isArray(appids)) {
    return res.status(400).send("appids must be an array.");
  }

  if (appids.some((i) => !Number.isInteger(i))) {
    return res.status(400).send("appids must be an integer array.");
  }

  if (appids.length > 32) {
    return res.status(400).send("Only 32 games are allowed per game.");
  }

  try {
    await SteamAccountAction.idleGames(req.session.userId, username, appids);
  } catch (error) {
    return res.status(400).send(error);
  }
  return res.send();
});

router.post(ROUTE + "changeavatar", upload.single("avatar"), async (req, res) => {
  const body = JSON.parse(JSON.stringify(req.body)); //multer is trash.
  const username = body.username;
  const avatar = req.file;

  if (!username || !avatar) {
    return res.status(400).send("username and avatar fields required.");
  }

  if (!avatar.mimetype.includes("image")) {
    return res.status(400).send("Avatar must be an image.");
  }

  if (avatar.size / 1024 > 1024) {
    return res.status(400).send("Avatar must be less than 1024Kb.");
  }

  try {
    await SteamAccountAction.changeAvatar(req.session.userId, username, avatar);
  } catch (error) {
    return res.status(400).send(error);
  }
  return res.send();
});

router.post(ROUTE + "changenick", async (req, res) => {
  const username = req.body.username;
  const nick = req.body.nick;

  if (!username || !nick) {
    return res.status(400).send("username and nick fields required.");
  }

  if (typeof nick !== "string") {
    return res.status(400).send("nick must be a string.");
  }

  try {
    await SteamAccountAction.changeNick(req.session.userId, username, nick);
  } catch (error) {
    return res.status(400).send(error);
  }
  return res.send();
});

router.post(ROUTE + "changeprivacy", async (req, res) => {
  const username = req.body.username;
  const settings = req.body.settings;

  if (!username || !settings) {
    return res.status(400).send("username and settings fields required.");
  }

  try {
    await SteamAccountAction.changePrivacy(req.session.userId, username, settings);
  } catch (error) {
    console.log(error);
    return res.status(400).send(error);
  }
  return res.send();
});

router.post(ROUTE + "clearaliases", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.sendStatus(400);
  }

  try {
    await SteamAccountAction.clearAliases(req.session.userId, username);
  } catch (error) {
    console.log(error);
    res.sendStatus(400);
  }
  return res.send();
});

router.post(ROUTE + "activatefreegame", async (req, res) => {
  const username = req.body.username;
  const appId = req.body.appId;

  if (!username || !appId) {
    return res.sendStatus(400);
  }

  try {
    //
  } catch (error) {
    res.sendStatus(400);
  }
  return res.send();
});

router.post(ROUTE + "activatef2pgame", async (req, res) => {
  const username = req.body.username;
  const appId = req.body.appId;

  if (!username || !appId) {
    return res.sendStatus(400);
  }

  try {
    //
  } catch (error) {
    res.sendStatus(400);
  }
  return res.send();
});

router.post(ROUTE + "redeemcdkey", async (req, res) => {
  const username = req.body.username;
  const cdkey = req.body.cdkey;

  if (!username || !cdkey) {
    return res.sendStatus(400);
  }

  try {
    //
  } catch (error) {
    res.sendStatus(400);
  }
  return res.send();
});

export default router;
