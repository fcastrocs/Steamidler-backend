import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import * as User from "../models/user";
import * as Invite from "../models/invite";
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

  // new user, set tempSession cookie
  if (!user) {
    res.cookie("tempSession", { credential, clientId }, { signed: true });
    return res.redirect(process.env.FRONTEND_URL + "/invite");
  }

  // authenticate user
  req.session.loggedId = true;
  req.session.userId = userId;
  res.cookie(
    "user-data",
    { name: payload.name, avatar: payload.picture },
    { signed: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
  );

  await User.upsert(userId, {
    userId,
    name: payload.name,
    email: payload.email,
  });

  res.redirect(process.env.FRONTEND_URL);
});

router.post("/register", async (req, res) => {
  const invite = req.body.invite;
  if (!invite) {
    return res.status(400).send("invalid body");
  }

  const tempSession = req.signedCookies.tempSession;
  if (!tempSession) {
    return res.status(400).send("tempSession cookie not set");
  }

  const credential = tempSession.credential;
  const clientId = tempSession.clientId;

  if (!credential || !clientId) {
    return res.status(400).send("invalid tempSession cookie");
  }

  // verify token
  const payload = await verifyToken(credential, clientId);
  if (!payload) return res.status(400).send("invalid token");

  // verify invite code
  if (!(await Invite.exists(invite, payload.email))) {
    return res.status(400).send("invalid invite");
  }

  // authenticate user
  await Invite.remove(payload.email);
  res.clearCookie("tempSession");

  const userId = payload.sub;
  req.session.loggedId = true;
  req.session.userId = userId;
  res.cookie(
    "user-data",
    { name: payload.name, avatar: payload.picture },
    { signed: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
  );

  await User.upsert(userId, {
    userId,
    name: payload.name,
    email: payload.email,
  });

  return res.redirect(process.env.FRONTEND_URL);
});

router.post("/logout", async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("session");
    res.clearCookie("user-data");
    res.send();
  });
});

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
