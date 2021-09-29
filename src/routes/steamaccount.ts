import { Router } from "express";
import * as SteamAccount from "../controllers/steamAccount";
const router = Router();

router.post("add", async (req, res) => {
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

router.post("login", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || !password) {
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

router.post("logout", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || !password) {
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
 * Make sure not to show user stack trace, normalize error to a string
 * @helper
 */
function normalizeError(error: unknown): string {
  let err = "";
  if (typeof error !== "string") {
    console.error(error);
    err = "An unexpected error occured.";
  } else {
    err = error;
  }

  return err;
}

export default router;
