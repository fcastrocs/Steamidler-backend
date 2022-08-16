import { steamWebLogin } from "../controllers/steamcommunity-actions.js";
import { Router } from "express";
import * as SteamAccount from "../controllers/steam-accounts.js";

const router = Router();

const ROUTE = "/steamaccount";

/**
 * Add a Steam Account
 */
router.post(ROUTE, async (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  const code = req.body.code;

  if (!username || !password) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await SteamAccount.add(req.body.userId, username, password, code);
  } catch (error) {
    return next(error);
  }

  return res.send();
});

/**
 * Login a Steam Account
 */
router.post(ROUTE + "/login", async (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  const code = req.body.code;

  if (!username) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await SteamAccount.login(req.body.userId, username, code, password);
  } catch (error) {
    return next(error);
  }
  return res.send();
});

/**
 * Login a Steam Account
 */
router.post(ROUTE + "/steamcommunitylogin", async (req, res, next) => {
  const username = req.body.username;

  if (!username) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await steamWebLogin({
      type: "relogin",
      relogin: { userId: req.body.userId, username },
    });
  } catch (error) {
    return next(error);
  }
  return res.send();
});

/**
 * Logout a Steam Account
 */
router.post(ROUTE + "/logout", async (req, res, next) => {
  const username = req.body.username;

  if (!username) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await SteamAccount.logout(req.body.userId, username);
  } catch (error) {
    return next(error);
  }

  return res.send();
});

/**
 * Remove a Steam Account
 */
router.delete(ROUTE, async (req, res, next) => {
  const username = req.body.username;

  if (!username) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await SteamAccount.remove(req.body.userId, username);
  } catch (error) {
    return next(error);
  }
  return res.send();
});

export default router;
