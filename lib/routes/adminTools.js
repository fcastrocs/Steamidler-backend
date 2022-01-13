import express, { Router } from "express";
import { addProxies } from "../models/proxy.js";
const router = Router();
const ROUTE = "/admintools";
/**
 * Middleware to check admin rights
 */
function isAdmin(req, res, next) {
    if (process.env.NODE_ENV === "production") {
        if (!req.session.isAdmin) {
            return res.sendStatus(404);
        }
    }
    return next();
}
/**
 * Add proxies
 */
router.post(ROUTE + "/addproxies", [isAdmin, express.text()], async (req, res) => {
    const proxies = req.body;
    if (!proxies || typeof proxies !== "string") {
        res.statusMessage = "invalid body";
        return res.status(400).send(res.statusMessage);
    }
    const array = proxies.split(/\r?\n/);
    if (!array.length) {
        res.statusMessage = "No proxies specified.";
        return res.status(400).send(res.statusMessage);
    }
    try {
        const insertedCount = await addProxies(array);
        return res.send(`Inserted ${insertedCount} proxies`);
    }
    catch (error) {
        res.statusMessage = error;
        return res.status(400).send(error);
    }
});
export default router;
