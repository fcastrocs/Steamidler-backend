import { Request, Response, Router } from "express";
import { OAuth2Client } from "google-auth-library";
import * as UserModel from "../models/users.js";
import * as Invite from "../models/invites.js";
import { User } from "../../@types/index.js";
const router = Router();

const ROUTE = "/user";

/**
 * google login response.
 * If user is not registered, it sets a tempSession cookie. Otherwise authenticates user.
 * tempSession cookie is used by register request
 */
router.post(ROUTE + "/googleresponse", async (req, res) => {
  if (req.session.loggedId) {
    return res.status(403).send("already logged in");
  }

  const credential = req.body.credential;
  const clientId = req.body.clientId;

  console.log(req);

  if (!credential || !clientId) {
    return res.status(400).send("invalid body");
  }

  // verify token
  const payload = await verifyToken(credential, clientId);
  if (!payload) return res.status(400).send("invalid token");

  const userId = payload.sub;
  const user = await UserModel.get(userId);

  // user is not registered, set tempSession to be used when registering
  if (!user) {
    res.cookie(
      "tempSession",
      { userId, avatar: payload.picture, email: payload.email },
      { signed: true, httpOnly: true, expires: new Date(Date.now() + 10 * 60000), secure: true }
    );
    return res.redirect(process.env.FRONTEND_URL + "/register");
  }

  // authenticate user
  await authenticateUser(res, req, user);

  res.redirect(process.env.FRONTEND_URL);
});

/**
 * Register new User
 */
router.post(ROUTE + "/register", async (req, res) => {
  const invite = req.body.invite;
  const nickname = req.body.nickname;
  if (!invite || !nickname) {
    res.statusMessage = "invalid body";
    return res.status(400).send(res.statusMessage);
  }

  const tempSession = req.signedCookies.tempSession;
  if (!tempSession) {
    return res.status(400).send("tempSession cookie not set");
  }

  const userId = tempSession.userId;
  const email = tempSession.email;
  const avatar = tempSession.avatar;

  if (!userId || !email || !avatar) {
    res.statusMessage = "invalid tempSession cookie";
    return res.status(400).send(res.statusMessage);
  }

  // verify invite code
  if (!(await Invite.inviteExists(invite, email))) {
    res.statusMessage = "invalid invite";
    return res.status(400).send(res.statusMessage);
  }

  // remove used invite
  await Invite.removeInvite(email);

  // clear uneeded temp session
  res.clearCookie("tempSession");

  // authenticate user
  await authenticateUser(res, req, {
    userId,
    nickname,
    email,
    avatar,
    role: "user",
    createdAt: new Date(),
    ip: "1.1.1.1",
  });

  return res.redirect(process.env.FRONTEND_URL);
});

router.post(ROUTE + "/logout", async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("session");
    res.clearCookie("user-data");
    res.send();
  });
});

/**
 * way to authenticate to test API in development
 */
router.post(ROUTE + "/authenticate", async (req, res) => {
  if (process.env.NODE_ENV === "production") return res.sendStatus(404);

  await authenticateUser(res, req, {
    userId: "1",
    nickname: "apiTest",
    email: "",
    avatar: "",
    role: "admin",
    createdAt: new Date(),
    ip: "1.1.1.1",
  });
  return res.send();
});

/**
 * authenticate and update user details
 */
async function authenticateUser(res: Response, req: Request, user: User) {
  // authenticate user
  req.session.loggedId = true;
  req.session.userId = user.userId;
  req.session.isAdmin = user.role === "admin" ? true : false;
  res.cookie(
    "user-data",
    { nickname: user.nickname, avatar: user.avatar },
    { signed: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
  );

  await UserModel.upsert(user);
}

/**
 * Verify google token
 */
async function verifyToken(credential: string, clientId: string) {
  const client = new OAuth2Client();
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
    if (payload == null) {
      return null;
    }
  } catch (error) {
    return null;
  }

  if (!payload.email && !payload.email_verified) {
    return null;
  }
  return payload;
}

export default router;
