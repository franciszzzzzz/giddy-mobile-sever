import express from "express";
import {
  initializePayment,
  verifyPayment,
  paymentWebhook,
} from "../controllers/paystackController.js";
import { verifyUserAuth } from "../middleware/userAuth.js";

const router = express.Router();

router.route("/payment/initialize").post(verifyUserAuth, initializePayment);
router.route("/payment/verify/:reference").get(verifyUserAuth, verifyPayment);
router
  .route("/webhook")
  .post(
    express.json({ verify: (req, res, buf) => (req.rawBody = buf) }),
    paymentWebhook,
  );

export default router;
