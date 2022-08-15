import argon2 from "argon2";
import { ERRORS, SteamIdlerError } from "../commons.js";
import * as UsersModel from "../models/users.js";
import * as InviteModel from "../models/invites.js";
import { GoogleRecaptchaResponse, User, UserInfo } from "../../@types/index.js";
import { ObjectId } from "mongodb";
import fetch from "node-fetch";

// https://stackoverflow.com/questions/19605150/regex-for-password-must-contain-at-least-eight-characters-at-least-one-number-a
const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,32}$/;
const EMAIL_REX =
  /^(("[\w\-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w\-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,24}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i;
const USERNAME_REX = /[a-zA-Z0-9]{3,12}/;

/**
 * Register a new user
 * @Controller
 */
export async function register(user: User, inviteCode: string, ip: string, g_response: string): Promise<UserInfo> {
  await recaptchaVerify(g_response);

  // validate username
  if (!USERNAME_REX.test(user.username)) throw new SteamIdlerError("InvalidUsername");

  // validate email
  if (!EMAIL_REX.test(user.email)) throw new SteamIdlerError("InvalidEmail");

  if (!PASSWORD_REGEX.test(user.password)) throw new SteamIdlerError("InvalidPassword");

  // check if user exists
  if (await UsersModel.get(user.email)) throw new SteamIdlerError(ERRORS.EXISTS);

  // check if this email has an invite
  if (!(await InviteModel.exits(user.email, inviteCode))) throw new SteamIdlerError(ERRORS.NOTFOUND);

  // adjust user fields
  user._id = new ObjectId();
  user.password = await argon2.hash(user.password);
  user.createdAt = new Date();

  user = await UsersModel.add(user);
  await InviteModel.remove(user.email);
  return { _id: user._id.toString(), username: user.username };
}

/**
 * Authenticate user
 * @Controller
 */
export async function login(email: string, password: string, g_response: string): Promise<UserInfo> {
  await recaptchaVerify(g_response);

  // check if user exists
  const user = await UsersModel.get(email);
  if (!user) throw new SteamIdlerError(ERRORS.BAD_PASSWORD_EMAIL);

  // Verify password
  if (await argon2.verify(user.password, password)) {
    delete user.password; // don't return with password
    return { _id: user._id.toString(), username: user.username };
  }
  throw new SteamIdlerError(ERRORS.BAD_PASSWORD_EMAIL);
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
