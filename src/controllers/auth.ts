import argon2 from "argon2";
import { ERRORS, SteamIdlerError } from "../commons.js";
import * as UsersModel from "../models/users.js";
import * as InviteModel from "../models/invites.js";
import * as RefreshTokensModel from "../models/refresh-tokens.js";
import { GoogleRecaptchaResponse, User } from "../../@types/index.js";
import { ObjectId } from "mongodb";
import fetch from "node-fetch";
import jwt, { JwtPayload } from "jsonwebtoken";

// https://stackoverflow.com/questions/19605150/regex-for-password-must-contain-at-least-eight-characters-at-least-one-number-a
const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,32}$/;
const EMAIL_REX =
  /^(("[\w\-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w\-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,24}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i;
const USERNAME_REX = /[a-zA-Z0-9]{3,12}/;

/**
 * Register a new user
 * @Controller
 */
export async function register(user: Partial<User>, inviteCode: string, g_response: string) {
  // verify google recaptcha
  if (process.env.NODE_ENV === "production") {
    await recaptchaVerify(g_response);
  }

  // validate username
  if (!USERNAME_REX.test(user.username)) throw new SteamIdlerError("InvalidUsername");

  // validate email
  if (!EMAIL_REX.test(user.email)) throw new SteamIdlerError("InvalidEmail");

  // validate password
  if (!PASSWORD_REGEX.test(user.password)) throw new SteamIdlerError("InvalidPassword");

  // sanitize email
  user.email = user.email.toLowerCase();

  // check if user exists
  if (await UsersModel.get(user.email)) throw new SteamIdlerError(ERRORS.EXISTS);

  // check if this email has an invite
  if (!(await InviteModel.exits({ email: user.email, code: inviteCode }))) {
    throw new SteamIdlerError(ERRORS.NOTFOUND);
  }

  // finish creating user
  user._id = new ObjectId();
  user.password = await argon2.hash(user.password);
  user.createdAt = new Date();

  // store user to database
  user = await UsersModel.add(user as User);

  // remove invite
  await InviteModel.remove(user.email);

  // create authentication
  return await createAuthentication(user._id);
}

/**
 * Authenticate user
 * @Controller
 */
export async function login(email: string, password: string, g_response: string) {
  // verify google recaptcha
  if (process.env.NODE_ENV === "production") {
    await recaptchaVerify(g_response);
  }

  // sanitize email
  email = email.toLowerCase();

  // check if user exists
  const user = await UsersModel.get(email);
  if (!user) throw new SteamIdlerError(ERRORS.BAD_PASSWORD_EMAIL);

  // Verify password
  if (!(await argon2.verify(user.password, password))) {
    throw new SteamIdlerError(ERRORS.BAD_PASSWORD_EMAIL);
  }

  // create authentication
  return await createAuthentication(user._id);
}

/**
 * Authenticate user
 * @Controller
 */
export async function logout(userId: ObjectId) {
  await RefreshTokensModel.remove(userId);
}

/**
 * verify authentication
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
    if (!(error instanceof jwt.TokenExpiredError)) {
      throw new SteamIdlerError("NotAuthenticated");
    }
  }

  // access token is not valid, validate refresh-token, the refresh access-token
  try {
    const payload = jwt.verify(refreshToken, process.env.ACCESS_SECRET) as JwtPayload;
    if (payload.aud !== "refresh") throw "bad";
  } catch (error) {
    throw new SteamIdlerError("NotAuthenticated");
  }

  // check refresh-token  matches the one in DB, otherwise this is an invalid token
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
