import express from "express";
import { OAuth2Client } from "google-auth-library";
const app = express();
import * as User from "../models/user";
import * as Invite from "../models/invite";

app.post("", async (req, res) => {
  // user is already logged in
  if (req.session.loggedId) {
    return res.sendStatus(403);
  }

  let credential = req.body.credential;
  let clientId = req.body.clientId;
  const invite = req.body.invite;

  // tempSession serves as a holder for google credentials until user
  // enters invite code
  const tempSession = req.signedCookies.tempSession;

  if (tempSession) {
    if (!tempSession.credential && !tempSession.clientId) {
      return res.sendStatus(400);
    }
    credential = tempSession.credential;
    clientId = tempSession.clientId;
  }

  if (!credential && !clientId) {
    return res.sendStatus(400);
  }

  // verify token
  const payload = await verifyToken(credential, clientId);
  if (!payload) return res.sendStatus(400);

  const userId = payload.sub;
  const user = await User.get(userId);

  // new user
  if (!user) {
    // request came from google, redirect to invite page
    if (!invite) {
      res.cookie("tempSession", { credential, clientId }, { signed: true });
      return res.redirect(process.env.FRONTEND_URL + "/invite"); // user can continue to send invite
    } else {
      //request came from invite page
      // invite doesn't exist
      if (!(await Invite.exists(invite, payload.email))) {
        return res.sendStatus(403);
      } else {
        // await Invite.remove(payload.email);
      }
    }
  }

  // good login or invite, authenticate user
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

  // remove tempSession cookie
  res.clearCookie("tempSession");
  res.sendStatus(200);
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

export default app;
