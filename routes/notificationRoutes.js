import express from "express";
import { registerDeviceToken } from "../controllers/notification.controller.js";

const router = express.Router();
router.route("/notifications/register-token").post(registerDeviceToken);

export default router;
