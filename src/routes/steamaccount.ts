import { Router } from "express";
import multer from "multer";
const upload = multer();
import * as SteamAccount from "../controllers/steamAccount";
import { getAll } from "../models/steamAccount";
const router = Router();

router.post("/steamaccount/add", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || !password) {
    return res.sendStatus(400);
  }

  try {
    await SteamAccount.add({ userId: req.session.userId, username, password });
  } catch (error) {
    const errorStr = normalizeError(error);
    return res.status(400).send(errorStr);
  }

  return res.sendStatus(200);
});

router.post("/steamaccount/login", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.sendStatus(400);
  }

  try {
    await SteamAccount.login(req.session.userId, username);
  } catch (error) {
    const errorStr = normalizeError(error);
    return res.status(400).send(errorStr);
  }
  return res.sendStatus(200);
});

router.post("/steamaccount/logout", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.sendStatus(400);
  }

  try {
    await SteamAccount.logout(req.session.userId, username);
  } catch (error) {
    const errorStr = normalizeError(error);
    return res.status(400).send(errorStr);
  }
  return res.sendStatus(200);
});

/**
 * Returns all steam accounts for this user.
 */
router.get("/steamaccounts", async (req, res) => {
  const accounts = await getAll(req.session.userId);
  res.send(accounts);
});

/**
 * Remove a steam account.
 */
router.delete("/steamaccount", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.sendStatus(400);
  }

  try {
    await SteamAccount.remove(req.session.userId, username);
  } catch (error) {
    res.sendStatus(400);
  }
  return res.send();
});

router.post("/steamaccount/changeavatar", upload.single("avatar"), async (req, res) => {
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
    await SteamAccount.changeAvatar(req.session.userId, username, avatar);
  } catch (error) {
    return res.status(400).send(error);
  }
  return res.send();
});

router.post("/steamaccount/changenick", async (req, res) => {
  const username = req.body.username;
  const nick = req.body.nick;

  if (!username || !nick) {
    return res.sendStatus(400);
  }

  if (!nick.length) {
    return res.sendStatus(400);
  }

  try {
    await SteamAccount.changeNick(req.session.userId, username, nick);
  } catch (error) {
    res.sendStatus(400);
  }
  return res.send();
});

router.post("/steamaccount/changeprivacy", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.sendStatus(400);
  }

  try {
    //
  } catch (error) {
    res.sendStatus(400);
  }
  return res.send();
});

router.post("/steamaccount/clearaliases", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.sendStatus(400);
  }

  try {
    //
  } catch (error) {
    res.sendStatus(400);
  }
  return res.send();
});

router.post("/steamaccount/activatefreegame", async (req, res) => {
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

router.post("/steamaccount/activatef2pgame", async (req, res) => {
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

router.post("/steamaccount/redeemcdkey", async (req, res) => {
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

/**
 * Make sure not to show user stack trace, normalize error to a string
 * @helper
 */
function normalizeError(error: unknown): string {
  console.error(error);

  let err = "";
  if (typeof error !== "string") {
    err = "An unexpected error occured.";
  } else {
    err = error;
  }

  return err;
}

export default router;
