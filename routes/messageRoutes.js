import express from "express";
import {
  createMessage,
  getMessages,
  markRead,
  deleteMessage,
} from "../controllers/messageController.js";
import { roleBasedAccess, verifyUserAuth } from "../middleware/userAuth.js";

const router = express.Router();

// Public create message (from contact form)
router.post("/messages", createMessage);

// Admin endpoints
router.get(
  "/admin/messages",
  verifyUserAuth,
  roleBasedAccess("admin"),
  getMessages
);
router.patch(
  "/admin/messages/:id/read",
  verifyUserAuth,
  roleBasedAccess("admin"),
  markRead
);
router.delete(
  "/admin/messages/:id",
  verifyUserAuth,
  roleBasedAccess("admin"),
  deleteMessage
);

export default router;
