import express from "express";
import { roleBasedAccess, verifyUserAuth } from "../middleware/userAuth.js";
import {
  getUserDetails,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updatePassword,
  updateUserProfile,
  refreshAccessToken,
  healthCheck,
} from "../controllers/userController.js";

const router = express.Router();
router.get("/health", healthCheck);
router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/logout").post(logoutUser);
router.route("/password/forgot").post(requestPasswordReset);
router.route("/reset/:token").post(resetPassword);
router.route("/profile").get(verifyUserAuth, getUserDetails);
router.route("/password/update").put(verifyUserAuth, updatePassword);
router.route("/profile/update").put(verifyUserAuth, updateUserProfile);

export default router;
