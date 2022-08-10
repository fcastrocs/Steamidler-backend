import { Router } from "express";
import * as AdminController from "../controllers/admin.js";
const router = Router();
const ROUTE = "/admin";
/**
 * Add proxies
 */
router.post(ROUTE + "/add-proxies", async (req, res, next) => {
    const proxies = req.body.proxies;
    const key = req.body.key;
    try {
        const insertedCount = await AdminController.addProxies(proxies, key);
        return res.send(insertedCount.toString());
    }
    catch (error) {
        return next(error);
    }
});
router.post(ROUTE + "/renew-steam-servers", async (req, res, next) => {
    const key = req.body.key;
    try {
        await AdminController.renewSteamServers(key);
    }
    catch (error) {
        return next(error);
    }
    return res.send();
});
router.post(ROUTE + "/create-invite", async (req, res, next) => {
    const key = req.body.key;
    const email = req.body.email;
    try {
        const invite = await AdminController.createInvite(email, key);
        res.send(invite);
    }
    catch (error) {
        return next(error);
    }
});
export default router;
