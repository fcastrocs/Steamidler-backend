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
  try {
    await SteamcommunityAction.changePrivacy(req.body.userId, username, settings);
    res.send("ok");
  } catch (error) {
    next(error);
  }
});

/**
 * Clear nickname history
 * @route
 */
router.post(ROUTE + "clearaliases", async (req, res, next) => {
  const username = req.body.username;
  try {
    await SteamcommunityAction.clearAliases(req.body.userId, username);
    res.send();
  } catch (error) {
    next(error);
  }
});

/**
 * Change profile avatar
 * @route
 */
router.post(ROUTE + "changeavatar", upload.single("avatar"), async (req, res, next) => {
  const username = req.body.username;
  const avatar = req.body.avatar;

  try {
    await SteamcommunityAction.changeAvatar(req.body.userId, username, avatar);
    res.send();
  } catch (error) {
    next(error);
  }
});

export default router;
