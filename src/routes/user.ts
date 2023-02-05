import { setCookie } from "../commons.js";
import { Router } from "express";
import * as UsersController from "../controllers/user.js";
const router = Router();
const ROUTE = "/user";

router.post(ROUTE + "/register", async (req, res, next) => {
  try {
    const auth = await UsersController.register(req.body);
    setCookie("access-token", auth.accessToken, res);
    setCookie("refresh-token", auth.refreshToken, res);
    res.send({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post(ROUTE + "/login", async (req, res, next) => {
  try {
    const auth = await UsersController.login(req.body);
    setCookie("access-token", auth.accessToken, res);
    setCookie("refresh-token", auth.refreshToken, res);
    res.send({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Terminate user session
 */
router.post(ROUTE + "/logout", async (req, res, next) => {
  try {
    await UsersController.logout(req.body);
    res.clearCookie("access-token");
    res.clearCookie("refresh-token");
    res.send({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
