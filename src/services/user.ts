import * as UsersModel from "../models/users.js";
import * as InviteModel from "../models/invite.js";
import * as RefreshTokensModel from "../models/refreshToken.js";
import * as PassResetTokensModel from "../models/passResetToken.js";
import * as ConfirmationCodesModel from "../models/confirmationCode.js";
import jwt, { JwtPayload } from "jsonwebtoken";
import fetch from "node-fetch";
import Mailer from "../mailer/index.js";
import argon2 from "argon2";
import { SteamIdlerError } from "../commons.js";
import { ObjectId } from "mongodb";
import {
  RegisterBody,
  LoginBody,
  LogoutBody,
  ResetPasswordBody,
  UpdatePasswordBody,
  FinalizeLoginBody,
} from "../../@types/controllers/user.js";

/**
 * @Service
 */
export async function register(body: RegisterBody) {
  // verify google recaptcha
  if (process.env.NODE_ENV === "production") {
    await recaptchaVerify(body.g_response);
  }

  // validate invite
  if (!(await InviteModel.exits({ email: body.email, code: body.inviteCode }))) {
    throw new SteamIdlerError("Invalid invite code.");
  }

  // check if user exists
  if (await UsersModel.get({ email: body.email })) {
    throw new SteamIdlerError("Email already exists.");
  }

  const user: User = {
    _id: new ObjectId(),
    username: body.username,
    email: body.email,
    password: body.password,
    ip: body.ip,
    createdAt: new Date(),
  };

  // save user
  await UsersModel.add(user);

  // remove invite
  await InviteModel.remove(user.email);

  // create authentication
  return createAuthentication(user._id);
}

/**
 * @Service
 */
export async function initLogin(body: LoginBody) {
  // verify google recaptcha
  if (process.env.NODE_ENV === "production") {
    await recaptchaVerify(body.g_response);
  }

  // check if user exists
  const user = await UsersModel.get({ email: body.email });
  if (!user) {
    throw new SteamIdlerError("Check your credentials.");
  }

  // Verify password
  if (!(await argon2.verify(user.password, body.password))) {
    throw new SteamIdlerError("Check your credentials.");
  }

  const code = await ConfirmationCodesModel.add(user._id);
  const mailer = new Mailer();
  mailer.sendConfirmationCode(user.email, code);

  return genInitLoginToken(user._id);
}

/**
 * @Service
 */
export async function finalizeLogin(body: FinalizeLoginBody) {
  const userId = validateInitLoginToken(body.initLoginToken);

  const code = await ConfirmationCodesModel.get(userId);
  if (!code) {
    throw new SteamIdlerError("Confirmation code expired.");
  }

  if (code !== body.code) {
    throw new SteamIdlerError("Confirmation code does not match.");
  }

  await ConfirmationCodesModel.remove(userId);

  return createAuthentication(userId);
}

/**
 * @Service
 */
export async function logout(body: LogoutBody) {
  await RefreshTokensModel.remove(body.userId);
}

/**
 * @Service
 */
export async function resetPassword(body: ResetPasswordBody) {
  // verify google recaptcha
  if (process.env.NODE_ENV === "production") {
    await recaptchaVerify(body.g_response);
  }

  // check if user exists
  const user = await UsersModel.get({ email: body.email });
  if (!user) return;

  const token = await PassResetTokensModel.add(user._id, user.email);
  const mailer = new Mailer();
  await mailer.sendPasswordReset(user.email, token);
}

/**
 * @Service
 */
export async function updatePassword(body: UpdatePasswordBody) {
  // check if user exists
  const user = await UsersModel.get({ email: body.email });
  if (!user) {
    throw new SteamIdlerError("Something went wrong.");
  }

  // validate token
  const token = await PassResetTokensModel.get({ userId: user._id, email: body.email });
  if (!token || token !== body.token) {
    throw new SteamIdlerError("Something went wrong.");
  }

  // update password
  await UsersModel.updatePassword(user._id, body.password);

  // remove invite
  await PassResetTokensModel.remove(user._id);

  // create authentication
  return createAuthentication(user._id);
}

/**
 * Verify authentication
 * @Service
 */
export async function verifyAuth(
  accessToken: string,
  refreshToken: string
): Promise<{ accessToken?: string; userId: ObjectId }> {
  // verify access-token
  try {
    const payload = jwt.verify(accessToken, process.env.ACCESS_SECRET) as JwtPayload;
    if (payload.aud !== "access") throw "bad";
    return { userId: new ObjectId(payload.sub) };
  } catch (error) {
    // do not throw if the access-token is expired, we should renew it.
    if (!(error instanceof jwt.TokenExpiredError)) {
      throw new SteamIdlerError("NotAuthenticated");
    }
  }

  // validate refresh-token before renewing access-token
  try {
    const payload = jwt.verify(refreshToken, process.env.ACCESS_SECRET) as JwtPayload;
    if (payload.aud !== "refresh") throw "bad";
  } catch (error) {
    throw new SteamIdlerError("NotAuthenticated");
  }

  // validate refresh-token against DB
  const payload = jwt.decode(refreshToken) as JwtPayload;
  const userId = new ObjectId(payload.sub);
  if (!(await RefreshTokensModel.has({ userId, token: refreshToken }))) {
    throw new SteamIdlerError("NotAuthenticated");
  }

  return { accessToken: genAccessToken(userId), userId };
}

async function recaptchaVerify(g_response: string) {
  const params = new URLSearchParams();
  params.append("secret", process.env.RECAPTCHA_SECRET);
  params.append("response", g_response);

  const res: GoogleRecaptchaResponse = (await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body: params,
  }).then((res) => res.json())) as unknown as GoogleRecaptchaResponse;

  if (res.success) return true;
  throw new SteamIdlerError(JSON.stringify(res));
}

async function createAuthentication(userId: ObjectId) {
  // generate tokens
  const accessToken = genAccessToken(userId);
  const refreshToken = genRefreshToken(userId);

  // store refresh token
  await RefreshTokensModel.upsert({ userId, token: refreshToken });

  return { accessToken, refreshToken };
}

function genAccessToken(userId: ObjectId) {
  return jwt.sign({}, process.env.ACCESS_SECRET, {
    expiresIn: "2h",
    audience: "access",
    subject: userId.toString(),
  });
}

function genRefreshToken(userId: ObjectId) {
  return jwt.sign({}, process.env.ACCESS_SECRET, {
    expiresIn: "1y",
    audience: "refresh",
    subject: userId.toString(),
  });
}

function genInitLoginToken(userId: ObjectId) {
  return jwt.sign({}, process.env.ACCESS_SECRET, {
    expiresIn: "5m",
    audience: "initLogin",
    subject: userId.toString(),
  });
}

function validateInitLoginToken(token: string) {
  try {
    const payload = jwt.verify(token, process.env.ACCESS_SECRET) as JwtPayload;
    if (payload.aud !== "initLogin") throw "bad";
    return new ObjectId(payload.sub);
  } catch (error) {
    throw new SteamIdlerError("NotAuthenticated");
  }
}
