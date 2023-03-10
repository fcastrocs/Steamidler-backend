import { Router } from "express";
import * as AdminController from "../controllers/admin.js";
const router = Router();

const ROUTE = "/admin";

/**
 * Add proxies
 */
router.post(ROUTE + "/add-proxies", async (req, res, next) => {
  const key = req.get("api-key");

  try {
    const inserted = await AdminController.addProxies(req.body, key);
    return res.send({ inserted });
  } catch (error) {
    return next(error);
  }
});

router.post(ROUTE + "/renew-steam-servers", async (req, res, next) => {
  const key = req.get("api-key");

  try {
    await AdminController.fetchSteamServers(key);
  } catch (error) {
    return next(error);
  }
  return res.send();
});

router.post(ROUTE + "/create-invite", async (req, res, next) => {
  const key = req.get("api-key");
  const email = req.body.email;

  try {
    const invite = await AdminController.createInvite(email, key);
    res.send(invite);
  } catch (error) {
    return next(error);
  }
});

export default router;
