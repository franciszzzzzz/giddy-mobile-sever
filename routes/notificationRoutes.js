import express from "express";
import {
  registerDeviceToken,
  sendTestNotification,
  sendTestWelcomeNotification,
  sendTestPaymentNotification,
} from "../controllers/notification.controller.js";
import { verifyUserAuth } from "../middleware/userAuth.js";

const router = express.Router();
router
  .route("/notifications/register-token")
  .post(verifyUserAuth, registerDeviceToken);

router.post("/notifications/test", verifyUserAuth, sendTestNotification);

router.post(
  "/notifications/test-welcome",
  verifyUserAuth,
  sendTestWelcomeNotification,
);

router.post(
  "/notifications/test-payment",
  verifyUserAuth,
  sendTestPaymentNotification,
);

export default router;
