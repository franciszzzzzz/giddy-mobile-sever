import express from "express";
import {
  registerDeviceToken,
  sendTestNotification,
} from "../controllers/notification.controller.js";
import { verifyUserAuth } from "../middleware/userAuth.js";

const router = express.Router();
router
  .route("/notifications/register-token")
  .post(verifyUserAuth, registerDeviceToken);

router.post("/notifications/test", verifyUserAuth, sendTestNotification);

export default router;
