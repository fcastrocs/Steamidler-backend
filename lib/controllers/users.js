import argon2 from "argon2";
import { ERRORS, SteamIdlerError } from "../commons.js";
import * as UsersModel from "../models/users.js";
import * as InviteModel from "../models/invites.js";
import * as RefreshTokensModel from "../models/refresh-tokens.js";
import { ObjectId } from "mongodb";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import crypto from "crypto";
// https://stackoverflow.com/questions/19605150/regex-for-password-must-contain-at-least-eight-characters-at-least-one-number-a
const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*\W)(?!.* ).{8,32}$/;
const EMAIL_REX = /^(("[\w\-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w\-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,24}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i;
const USERNAME_REX = /[a-zA-Z0-9]{3,12}/;
/**
 * Register a new user
 * @Controller
 */
export async function register(user, inviteCode, g_response) {
    // verify google recaptcha
    if (process.env.NODE_ENV === "production") {
        await recaptchaVerify(g_response);
    }
    // validate username
    if (!USERNAME_REX.test(user.username))
        throw new SteamIdlerError("InvalidUsername");
    // validate email
    if (!EMAIL_REX.test(user.email))
        throw new SteamIdlerError("InvalidEmail");
    // validate password
    if (!PASSWORD_REGEX.test(user.password))
        throw new SteamIdlerError("InvalidPassword");
    // sanitize email
    user.email = user.email.toLowerCase();
    // check if user exists
    if (await UsersModel.get(user.email))
        throw new SteamIdlerError(ERRORS.EXISTS);
    // check if this email has an invite
    if (!(await InviteModel.exits({ email: user.email, code: inviteCode }))) {
        throw new SteamIdlerError(ERRORS.NOTFOUND);
    }
    // finish creating user
    user._id = new ObjectId();
    user.password = await argon2.hash(user.password);
    user.createdAt = new Date();
    // store user to database
    user = await UsersModel.add(user);
    // remove database
    await InviteModel.remove(user.email);
    // create authentication
    return await createAuthentication(user);
}
/**
 * Authenticate user
 * @Controller
 */
export async function login(email, password, g_response) {
    // verify google recaptcha
    if (process.env.NODE_ENV === "production") {
        await recaptchaVerify(g_response);
    }
    // sanitize email
    email = email.toLowerCase();
    // check if user exists
    const user = await UsersModel.get(email);
    if (!user)
        throw new SteamIdlerError(ERRORS.BAD_PASSWORD_EMAIL);
    // Verify password
    if (!(await argon2.verify(user.password, password))) {
        throw new SteamIdlerError(ERRORS.BAD_PASSWORD_EMAIL);
    }
    // create authentication
    return await createAuthentication(user);
}
/**
 * Authenticate user
 * @Controller
 */
export async function logout(userId) {
    await RefreshTokensModel.remove(userId);
}
/**
 * verify authentication
 */
export async function verifyAuth(accessJWT, refreshToken) {
    // decode user payload from access token
    const payload = jwt.decode(accessJWT);
    // remove jwt payload properties
    delete payload.iat;
    delete payload.exp;
    const user = payload;
    try {
        jwt.verify(accessJWT, process.env.ACCESS_SECRET);
        return { user };
    }
    catch (err) {
        // access jwt is not valid
        if (!(await RefreshTokensModel.has({ userId: new ObjectId(user._id), token: refreshToken }))) {
            // both accessJWT and refreshtoken are not valid
            throw new SteamIdlerError("NotAuthenticated");
        }
    }
    return { user, accessJWT: genAccessJWT(user) };
}
async function recaptchaVerify(g_response) {
    const params = new URLSearchParams();
    params.append("secret", process.env.RECAPTCHA_SECRET);
    params.append("response", g_response);
    const res = (await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        body: params,
    }).then((res) => res.json()));
    if (res.success)
        return true;
    throw new SteamIdlerError(JSON.stringify(res));
}
async function createAuthentication(user) {
    delete user.password; // never return password
    // generate tokens
    const acessJWT = genAccessJWT(user);
    const refreshToken = genRefreshToken();
    // store refresh token
    await RefreshTokensModel.upsert({ userId: user._id, token: refreshToken });
    return { user, acessJWT, refreshToken };
}
function genAccessJWT(user) {
    return jwt.sign(user, process.env.ACCESS_SECRET, { expiresIn: "5m" });
}
function genRefreshToken() {
    return crypto.randomBytes(64).toString("hex");
}
