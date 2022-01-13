import { Router } from "express";
import * as SteamAccount from "../controllers/steamAccount.js";
import { getAll } from "../models/steamAccount.js";
const router = Router();
const ROUTE = "/steamaccount/";
/**
 * Add a Steam Account
 */
router.post(ROUTE + "add", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const code = req.body.code;
    if (!username || !password) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await SteamAccount.add(req.session.userId, username, password, code);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(error);
    }
    return res.send();
});
/**
 * Login a Steam Account
 */
router.post(ROUTE + "login", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const code = req.body.code;
    if (!username) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await SteamAccount.login(req.session.userId, username, code, password);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(error);
    }
    return res.send();
});
/**
 * Logout a Steam Account
 */
router.post(ROUTE + "logout", async (req, res) => {
    const username = req.body.username;
    if (!username) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await SteamAccount.logout(req.session.userId, username);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(error);
    }
    return res.send();
});
/**
 * Remove a Steam Account
 */
router.delete("/steamaccount", async (req, res) => {
    const username = req.body.username;
    if (!username) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await SteamAccount.remove(req.session.userId, username);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(error);
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
