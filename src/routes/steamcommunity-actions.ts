import { Router } from "express";
import multer from "multer";
const upload = multer();
const router = Router();
import * as SteamcommunityAction from "../controllers/steamcommunity-actions.js";
const ROUTE = "/steamaccount/action/";

/**
 * Change profile privacy
 * @route
 */
router.post(ROUTE + "changeprivacy", async (req, res, next) => {
  const username = req.body.username;
  const settings = req.body.settings;

  if (!username || !settings) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await SteamcommunityAction.changePrivacy(req.session.userId, username, settings);
    return res.send("ok");
  } catch (error) {
    return next(error);
  }
});

/**
 * Clear nickname history
 * @route
 */
router.post(ROUTE + "clearaliases", async (req, res, next) => {
  const username = req.body.username;

  if (!username) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await SteamcommunityAction.clearAliases(req.session.userId, username);
    return res.send("ok");
  } catch (error) {
    return next(error);
  }
});

/**
 * Change profile avatar
 * @route
 */
router.post(ROUTE + "changeavatar", upload.single("avatar"), async (req, res, next) => {
  const body = JSON.parse(JSON.stringify(req.body)); //multer is trash.
  const username = body.username;
  const avatar = req.file;

  if (!username || !avatar) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  if (!avatar.mimetype.includes("image")) {
    res.statusMessage = "avatar must be an image";
    return res.status(400).send(res.statusMessage);
  }

  if (avatar.size / 1024 > 1024) {
    res.statusMessage = "avatar must be less than 1024Kb";
    return res.status(400).send(res.statusMessage);
  }

  try {
    await SteamcommunityAction.changeAvatar(req.session.userId, username, avatar);
    return res.send("ok");
  } catch (error) {
    return next(error);
  }
});

export default router;
