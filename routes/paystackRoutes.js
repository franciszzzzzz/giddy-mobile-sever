import express from "express";
import {
  initializePayment,
  verifyPayment,
  paystackWebhook,
} from "../controllers/paystackController.js";
import { verifyUserAuth } from "../middleware/userAuth.js";

const router = express.Router();

router.route("/payment/initialize").post(verifyUserAuth, initializePayment);
router.route("/payment/verify/:reference").get(verifyUserAuth, verifyPayment);
router
  .route("/webhook")
  .post(
    express.json({ verify: (req, res, buf) => (req.rawBody = buf) }),
    paystackWebhook,
  );

export default router;
