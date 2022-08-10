import { SteamIdlerError } from "../commons.js";
import { Router } from "express";
import * as UsersController from "../controllers/users.js";
const router = Router();
const ROUTE = "/user";
router.post(ROUTE + "/register", async (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    const inviteCode = req.body.inviteCode;
    const ip = req.clientIp;
    try {
        const user = await UsersController.register(email, password, inviteCode, ip);
        setSession(req, user);
    }
    catch (error) {
        return next(error);
    }
    return res.send();
});
router.post(ROUTE + "/login", async (req, res, next) => {
    if (req.session.userId) {
        return next(new SteamIdlerError("AlreadyLoggedIn"));
    }
    const email = req.body.email;
    const password = req.body.password;
    try {
        const user = await UsersController.login(email, password);
        setSession(req, user);
    }
    catch (error) {
        return next(error);
    }
    return res.send();
});
/**
 * Terminate user session
 */
router.post(ROUTE + "/logout", async (req, res) => {
    req.session.destroy(() => {
        res.send();
    });
});
function setSession(req, user) {
    // set session
    req.session.userId = user._id.toString();
}
export default router;
