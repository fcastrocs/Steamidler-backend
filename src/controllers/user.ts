import { SteamIdlerError } from "../commons.js";
import { LoginBody, LogoutBody, RegisterBody } from "../../@types/controllers/user.js";
import * as UserService from "../services/user.js";

// https://stackoverflow.com/questions/19605150/regex-for-password-must-contain-at-least-eight-characters-at-least-one-number-a
const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,32}$/;
const EMAIL_REX =
  /^(("[\w\-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w\-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,24}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i;
const USERNAME_REX = /[a-zA-Z0-9]{3,12}/;

/**
 * Register a new user
 * @Controller
 */
export async function register(body: RegisterBody) {
  // validate username
  if (!USERNAME_REX.test(body.username)) throw new SteamIdlerError("Invalid username.");

  // validate email
  if (!EMAIL_REX.test(body.email)) throw new SteamIdlerError("Invalid email.");

  // validate password
  if (!PASSWORD_REGEX.test(body.password)) throw new SteamIdlerError("Invalid password.");

  // sanitize email
  body.email = body.email.toLowerCase();

  return await UserService.register(body);
}

/**
 * Authenticate user
 * @Controller
 */
export async function login(body: LoginBody) {
  // validate email
  if (!EMAIL_REX.test(body.email)) throw new SteamIdlerError("InvalidEmail");

  // sanitize email
  body.email = body.email.toLowerCase();
  return await UserService.login(body);
}

/**
 * Authenticate user
 * @Controller
 */
export async function logout(body: LogoutBody) {
  return await UserService.logout(body);
}
