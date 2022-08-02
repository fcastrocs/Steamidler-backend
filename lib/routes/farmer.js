import { startFarmer, stopFarmer } from "../controllers/farmer.js";
import { Router } from "express";
const router = Router();
const ROUTE = "/steamaccount/farmer/";
/**
 * Start Farmer
 */
router.post(ROUTE + "start", async (req, res) => {
    const username = req.body.username;
    if (!username) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await startFarmer(req.session.userId, username);
    }
    catch (error) {
        console.error(error);
        res.statusMessage = error;
        return res.status(400).send(error);
    }
    return res.send();
});
/**
 * Stop Farmer
 */
router.post(ROUTE + "stop", async (req, res) => {
    const username = req.body.username;
    if (!username) {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    try {
        await stopFarmer(req.session.userId, username);
    }
    catch (error) {
        console.error(error);
        res.statusMessage = error;
        return res.status(400).send(error);
    }
    return res.send();
});
export default router;
