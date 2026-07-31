import express from "express";
import { registerDeviceToken } from "../controllers/notification.controller.js";
import { verifyUserAuth } from "../middleware/userAuth.js";

const router = express.Router();
router
  .route("/notifications/register-token")
  .post(verifyUserAuth, registerDeviceToken);

export default router;
