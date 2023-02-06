import { Router } from "express";
import * as UserModel from "../models/users.js";
const router = Router();

router.get("", async (req, res) => {
  const user = await UserModel.get({ _id: req.body.userId });
  res.send({
    "api-version": process.env.npm_package_version,
    authenticated: true,
    username: user.username,
    createdAt: user.createdAt,
  });
});

export default router;
