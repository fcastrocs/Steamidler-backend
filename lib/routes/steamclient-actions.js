import { Router } from "express";
const router = Router();
import * as SteamClientAction from "../controllers/steamclient-actions.js";
const ROUTE = "/steamaccount/action/";
/**
 * Idle steam games
 * @route
 */
router.post(ROUTE + "idlegames", async (req, res, next) => {
    const username = req.body.username;
    const appids = req.body.appids;
    try {
        await SteamClientAction.idleGames(req.body.userId, username, appids);
        res.send();
    }
    catch (error) {
        next(error);
    }
});
/**
 * Change nickname
 * @route
 */
router.post(ROUTE + "changenick", async (req, res, next) => {
    const username = req.body.username;
    const nick = req.body.nick;
    try {
        await SteamClientAction.changeNick(req.body.userId, username, nick);
        res.send();
    }
    catch (error) {
        next(error);
    }
});
/**
 * Activate free to play game
 * @route
 */
router.post(ROUTE + "activatef2pgames", async (req, res, next) => {
    const username = req.body.username;
    const appids = req.body.appids;
    try {
        const games = await SteamClientAction.activatef2pgame(req.body.userId, username, appids);
        res.send(games);
    }
    catch (error) {
        next(error);
    }
});
/**
 * Redeem game cdkey
 * @route
 */
router.post(ROUTE + "cdkeyredeem", async (req, res, next) => {
    const username = req.body.username;
    const cdkey = req.body.cdkey;
    try {
        const games = await SteamClientAction.cdkeyRedeem(req.body.userId, username, cdkey);
        res.send(games);
    }
    catch (error) {
        next(error);
    }
});
export default router;
