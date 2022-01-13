import { Request, Response, Router } from "express";
import { OAuth2Client } from "google-auth-library";
import * as User from "../models/user.js";
import * as Invite from "../models/invite.js";
import { IUser } from "@types";
const router = Router();

/**
 * Catches google login response. If user is not registered, it sets a tempSession cookie.
 * Otherwise logs user in.
 * tempSession cookie is used by the font-end to show invite code form.
 */
router.post("/googleresponse", async (req, res) => {
  if (req.session.loggedId) {
    return res.status(403).send("already logged in");
  }

  const credential = req.body.credential;
  const clientId = req.body.clientId;

  if (!credential || !clientId) {
    return res.status(400).send("invalid body");
  }

  // verify token
  const payload = await verifyToken(credential, clientId);
  if (!payload) return res.status(400).send("invalid token");

  const userId = payload.sub;
  const user = await User.get(userId);

  // user is not registered, set tempSession to be used when registering
  if (!user) {
    res.cookie(
      "tempSession",
      { credential, clientId },
      { signed: true, httpOnly: true, expires: new Date(Date.now() + 10 * 60000), secure: true }
    );
    return res.redirect(process.env.FRONTEND_URL + "/register");
  }

  // authenticate user
  await authenticateUser(res, req, user);

  res.redirect(process.env.FRONTEND_URL);
});

router.post("/register", async (req, res) => {
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

  const credential = tempSession.credential;
  const clientId = tempSession.clientId;

  if (!credential || !clientId) {
    res.statusMessage = "invalid tempSession cookie";
    return res.status(400).send(res.statusMessage);
  }

  // verify token
  const payload = await verifyToken(credential, clientId);
  if (!payload) {
    res.statusMessage = "invalid token";
    return res.status(400).send(res.statusMessage);
  }

  // verify invite code
  if (!(await Invite.exists(invite, payload.email))) {
    res.statusMessage = "invalid invite";
    return res.status(400).send(res.statusMessage);
  }

  // remove used invite
  await Invite.remove(payload.email);

  // clear uneeded temp session
  res.clearCookie("tempSession");

  // authenticate user
  await authenticateUser(res, req, { userId: payload.sub, nickname, email: payload.email, avatar: payload.picture });

  return res.redirect(process.env.FRONTEND_URL);
});

router.post("/logout", async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("session");
    res.clearCookie("user-data");
    res.send();
  });
});

async function authenticateUser(res: Response, req: Request, user: IUser) {
  // authenticate user
  req.session.loggedId = true;
  req.session.userId = user.userId;
  res.cookie(
    "user-data",
    { nickname: user.nickname, avatar: user.avatar },
    { signed: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
  );

  await User.upsert(user.userId, {
    userId: user.userId,
    nickname: user.nickname,
    email: user.email,
    avatar: user.avatar,
  });
}

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
