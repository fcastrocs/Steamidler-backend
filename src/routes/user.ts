import { SteamIdlerError } from "../commons.js";
import { Request, Router } from "express";
import { User, UserInfo } from "../../@types/index.js";
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

  const user: User = {
    username,
    email,
    password,
    ip,
  } as User;

  try {
    const userInfo = await UsersController.register(user, inviteCode, ip, g_response);
    setSession(req, userInfo);
    res.send(userInfo);
  } catch (error) {
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
    const userInfo = await UsersController.login(email, password, g_response);
    setSession(req, userInfo);
    res.send(userInfo);
  } catch (error) {
    next(error);
  }
});

/**
 * Terminate user session
 */
router.post(ROUTE + "/logout", async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("session");
    res.send({ message: "ok" });
  });
});

function setSession(req: Request, user: UserInfo) {
  req.session.userId = user._id;
}

export default router;
