import { Router } from "express";
import * as SteamAccount from "../controllers/SteamAccount";
import { getAll } from "../models/steamAccount";
const router = Router();

const ROUTE = "/steamaccount/";

router.post(ROUTE + "add", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const code = req.body.code;

  if (!username || !password) {
    return res.sendStatus(400);
  }

  try {
    await SteamAccount.add(req.session.userId, username, password, code);
  } catch (error) {
    const errorStr = normalizeError(error);
    return res.status(400).send(errorStr);
  }

  return res.sendStatus(200);
});

router.post(ROUTE + "login", async (req, res) => {
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

router.post(ROUTE + "logout", async (req, res) => {
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

/**
 * Returns all steam accounts for this user.
 */
router.get("/steamaccounts", async (req, res) => {
  const accounts = await getAll(req.session.userId);
  res.send(accounts);
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
