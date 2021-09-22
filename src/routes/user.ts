import express from "express";
import { OAuth2Client } from "google-auth-library";
const app = express();
import * as User from "../models/user";
import * as Invite from "../models/invite";

app.post("", async (req, res) => {
  const token = req.body.credential;
  const clientId = req.body.clientId;
  const invite = req.body.invite;

  if (!token && !clientId) {
    return res.sendStatus(401);
  }

  // verify token
  const payload = await verifyToken(token, clientId);
  if (!payload) return res.sendStatus(401);

  const userId = payload.sub;
  const user = await User.get(userId);

  // this must be a new user registration request
  if (!user) {
    // request came from google, redirect to invite page
    if (!invite) {
      res.cookie(
        "tempSession",
        JSON.stringify({ clientId, credential: token })
      );
      return res.redirect("http://localhost:3000/invite");
    } else {
      //request came from invite page
      const exists = await Invite.exists(invite, payload.email || "");
      // invite doesn't exist
      if (!exists) {
        return res.sendStatus(404);
      } else {
        await Invite.remove(payload.email || "");
      }
    }
  }

  // good signin or invite, authenticate user

  const cookieValue = JSON.stringify({
    name: payload.name,
    avatar: payload.picture,
    token,
  });

  await User.upsert(userId, {
    userId,
    name: payload.name || "",
    email: payload.email || "",
    token,
  });
  res.cookie("session", cookieValue);
  return res.redirect("http://localhost:3000");
});

async function verifyToken(token: string, clientId: string) {
  const client = new OAuth2Client();
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
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
