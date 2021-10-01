import { Router } from "express";
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
