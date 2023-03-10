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

router.post(ROUTE + "/initlogin", async (req, res, next) => {
  try {
    const token = await UsersController.initLogin(req.body);
    setCookie("init-login-token", token, res);
    res.send({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post(ROUTE + "/finalizelogin", async (req, res, next) => {
  try {
    req.body.initLoginToken = req.cookies["init-login-token"];
    const auth = await UsersController.finalizeLogin(req.body);
    res.clearCookie("init-login-token");
    setCookie("access-token", auth.accessToken, res);
    setCookie("refresh-token", auth.refreshToken, res);
    res.send({ success: true });
  } catch (error) {
    next(error);
  }
});

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

router.post(ROUTE + "/resetpassword", async (req, res, next) => {
  try {
    await UsersController.resetPassword(req.body);
    res.send({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post(ROUTE + "/updatepassword", async (req, res, next) => {
  try {
    const auth = await UsersController.updatePassword(req.body);
    setCookie("access-token", auth.accessToken, res);
    setCookie("refresh-token", auth.refreshToken, res);
    res.send({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post(ROUTE + "/verifyauth", async (req, res, next) => {
  if (!req.cookies || !req.cookies["access-token"] || !req.cookies["refresh-token"]) {
    return res.status(401).send({ authenticated: false });
  }

  try {
    const auth = await UsersController.verifyAuth({
      accessToken: req.cookies["access-token"],
      refreshToken: req.cookies["refresh-token"],
    });
    // set new access token
    if (auth.accessToken) {
      setCookie("access-token", auth.accessToken, res);
    }
    return res.send({ success: true });
  } catch (error) {
    res.clearCookie("access-token");
    res.clearCookie("refresh-token");
    return next(error);
  }
});

export default router;
