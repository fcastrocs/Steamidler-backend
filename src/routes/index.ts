import { Router } from "express";
import * as UserModel from "../models/users.js";
const router = Router();

router.get("", async (req, res, next) => {
  const user = await UserModel.get({ _id: req.body.userId });
  try {
    res.send({
      "api-version": process.env.npm_package_version,
      authenticated: true,
      username: user.username,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
