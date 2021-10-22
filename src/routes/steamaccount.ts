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
    return res.status(400).send("invalid body");
  }

  try {
    await SteamAccount.add(req.session.userId, username, password, code);
  } catch (error) {
    // this route should absolutly only throw string errors, which are expected
    if (typeof error !== "string") {
      console.error(error);
      return res.status(500).send("Unexpected error occurred, try again.");
    }

    return res.status(400).send(error);
  }

  return res.send();
});

router.post(ROUTE + "login", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.status(400).send("invalid body");
  }

  try {
    await SteamAccount.login(req.session.userId, username);
  } catch (error) {
    return res.status(400).send(error);
  }
  return res.send();
});

router.post(ROUTE + "logout", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.status(400).send("invalid body");
  }

  try {
    await SteamAccount.logout(req.session.userId, username);
  } catch (error) {
    // this route should absolutly only throw string errors, which are expected
    if (typeof error !== "string") {
      console.error(error);
      return res.status(500).send("Unexpected error occurred, try again.");
    }

    return res.status(400).send(error);
  }
  return res.send();
});

/**
 * Remove a steam account.
 */
router.delete("/steamaccount", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.status(400).send("invalid body");
  }

  try {
    await SteamAccount.remove(req.session.userId, username);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Unexpected error occurred, try again.");
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

export default router;
