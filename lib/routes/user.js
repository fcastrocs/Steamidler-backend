import { setCookie } from "../commons.js";
import { Router } from "express";
import * as UsersController from "../controllers/users.js";
const router = Router();
const ROUTE = "/user";
router.post(ROUTE + "/register", async (req, res, next) => {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;
    const inviteCode = req.body.inviteCode;
    const ip = req.clientIp;
    const g_response = req.body.g_response;
    // create user without _id
    const user = {
        username,
        email,
        password,
        ip,
    };
    try {
        const auth = await UsersController.register(user, inviteCode, g_response);
        setCookie("access-jwt", auth.acessJWT, res);
        setCookie("refresh-token", auth.refreshToken, res);
        res.send(auth.user);
    }
    catch (error) {
        next(error);
    }
});
router.post(ROUTE + "/login", async (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    const g_response = req.body.g_response;
    try {
        const auth = await UsersController.login(email, password, g_response);
        setCookie("access-jwt", auth.acessJWT, res);
        setCookie("refresh-token", auth.refreshToken, res);
        res.send(auth.user);
    }
    catch (error) {
        next(error);
    }
});
/**
 * Terminate user session
 */
router.post(ROUTE + "/logout", async (req, res, next) => {
    try {
        await UsersController.logout(req.body.userId);
        res.clearCookie("access-jwt");
        res.clearCookie("refresh-token");
        res.send({ message: "ok" });
    }
    catch (error) {
        next(error);
    }
});
export default router;
