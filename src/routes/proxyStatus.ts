import { Router } from "express";
import * as ProxyStatusController from "../controllers/proxyStatus.js";
const router = Router();
const ROUTE = "/proxystatus";

router.get(ROUTE + "/get", async (req, res, next) => {
  try {
    const results = await ProxyStatusController.getResults();
    res.send(results);
  } catch (error) {
    next(error);
  }
});

export default router;