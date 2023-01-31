import { Router } from "express";
import * as SteamAccount from "../controllers/steam-accounts.js";
const router = Router();
const ROUTE = "/steamaccount";
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
    }
    catch (error) {
        return next(error);
    }
    return res.send();
});
export default router;
