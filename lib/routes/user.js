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
    const g_response = req.body.g_response;
    try {
        const user = await UsersController.register(email, password, inviteCode, ip, g_response);
        setSession(req, user);
        res.send(user);
    }
    catch (error) {
        next(error);
    }
});
router.post(ROUTE + "/login", async (req, res, next) => {
    if (req.session.userId) {
        return next(new SteamIdlerError("AlreadyLoggedIn"));
    }
    const email = req.body.email;
    const password = req.body.password;
    const g_response = req.body.g_response;
    try {
        const user = await UsersController.login(email, password, g_response);
        setSession(req, user);
        res.send(user);
    }
    catch (error) {
        next(error);
    }
});
/**
 * Terminate user session
 */
router.post(ROUTE + "/logout", async (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("session");
        res.send();
    });
});
function setSession(req, user) {
    // set session
    req.session.userId = user._id.toString();
}
export default router;
