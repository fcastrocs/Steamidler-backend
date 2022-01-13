import { Router } from "express";
import multer from "multer";
const upload = multer();
import * as SteamAccountAction from "../controllers/SteamAccountAction.js";
const router = Router();
const ROUTE = "/steamaccount/action/";
router.post(ROUTE + "idlegames", async (req, res) => {
    const username = req.body.username;
    const appids = req.body.appids;
    if (!username || !appids) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    if (!Array.isArray(appids)) {
        res.statusMessage = "appids must be an array";
        return res.status(400).send(res.statusMessage);
    }
    if (appids.some((i) => !Number.isInteger(i))) {
        res.statusMessage = "appids must be an integer array";
        return res.status(400).send(res.statusMessage);
    }
    if (appids.length > 32) {
        res.statusMessage = "only 32 games are allowed per game";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await SteamAccountAction.idleGames(req.session.userId, username, appids);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(error);
    }
    return res.send();
});
router.post(ROUTE + "changeavatar", upload.single("avatar"), async (req, res) => {
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
        await SteamAccountAction.changeAvatar(req.session.userId, username, avatar);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(res.statusMessage);
    }
    return res.send();
});
router.post(ROUTE + "changenick", async (req, res) => {
    const username = req.body.username;
    const nick = req.body.nick;
    if (!username || !nick) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    if (typeof nick !== "string") {
        res.statusMessage = "nick must be a string";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await SteamAccountAction.changeNick(req.session.userId, username, nick);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(res.statusMessage);
    }
    return res.send();
});
router.post(ROUTE + "changeprivacy", async (req, res) => {
    const username = req.body.username;
    const settings = req.body.settings;
    if (!username || !settings) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await SteamAccountAction.changePrivacy(req.session.userId, username, settings);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(res.statusMessage);
    }
    return res.send();
});
router.post(ROUTE + "clearaliases", async (req, res) => {
    const username = req.body.username;
    if (!username) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await SteamAccountAction.clearAliases(req.session.userId, username);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(res.statusMessage);
    }
    return res.send();
});
router.post(ROUTE + "activatefreegame", async (req, res) => {
    const username = req.body.username;
    const appId = req.body.appId;
    if (!username || !appId) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        //
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(res.statusMessage);
    }
    return res.send();
});
router.post(ROUTE + "activatef2pgame", async (req, res) => {
    const username = req.body.username;
    const appId = req.body.appId;
    if (!username || !appId) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        //
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(res.statusMessage);
    }
    return res.send();
});
router.post(ROUTE + "redeemcdkey", async (req, res) => {
    const username = req.body.username;
    const cdkey = req.body.cdkey;
    if (!username || !cdkey) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        //
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(res.statusMessage);
    }
    return res.send();
});
export default router;
