import argon2 from "argon2";
import { ERRORS, SteamIdlerError } from "../commons.js";
import * as UsersModel from "../models/users.js";
import * as InviteModel from "../models/invites.js";
import { User } from "../../@types/index.js";
import { ObjectId } from "mongodb";

// https://stackoverflow.com/questions/19605150/regex-for-password-must-contain-at-least-eight-characters-at-least-one-number-a
const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,16}$/;
const EMAIL_REX =
  /^(("[\w\-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w\-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,24}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i;

/**
 * Register a new user
 * @Controller
 */
export async function register(email: string, password: string, inviteCode: string, ip: string) {
  // validate email
  if (!EMAIL_REX.test(email)) throw new SteamIdlerError("InvalidEmail");

  if (!PASSWORD_REGEX.test(password)) throw new SteamIdlerError("InvalidPassword");

  // check if user exists
  if (await UsersModel.get(email)) throw new SteamIdlerError(ERRORS.EXISTS);

  // check if this email has an invite
  if (!(await InviteModel.exits(email, inviteCode))) throw new SteamIdlerError(ERRORS.NOTFOUND);

  // create user
  let user: User = {
    _id: new ObjectId(),
    email,
    password: await argon2.hash(password),
    createdAt: new Date(),
    ip,
  };

  user = await UsersModel.add(user);
  await InviteModel.remove(email);
  delete user.password; // don't return with password
  return user;
}

/**
 * Authenticate user
 * @Controller
 */
export async function login(email: string, password: string) {
  // check if user exists
  const user = await UsersModel.get(email);
  if (!user) throw new SteamIdlerError(ERRORS.BAD_PASSWORD_EMAIL);

  // Verify password
  if (await argon2.verify(user.password, password)) {
    delete user.password; // don't return with password
    return user;
  }
  throw new SteamIdlerError(ERRORS.BAD_PASSWORD_EMAIL);
}
