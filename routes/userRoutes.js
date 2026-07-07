import express from "express";
import { roleBasedAccess, verifyUserAuth } from "../middleware/userAuth.js";
import { upload } from "../middleware/multer.js";
import {
  deleteUser,
  getSingleUsersList,
  getUserDetails,
  getUsersList,
  loginAdmin,
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updatePassword,
  updateUserProfile,
  updateUserRole,
  refreshAccessToken,
  healthCheck,
} from "../controllers/userController.js";

const router = express.Router();
router.get("/health", healthCheck);
router.route("/register").post(upload.single("avatar"), registerUser);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/logout").post(logoutUser);
router.route("/password/forgot").post(requestPasswordReset);
router.route("/reset/:token").post(resetPassword);
router.route("/profile").get(verifyUserAuth, getUserDetails);
router.route("/password/update").put(verifyUserAuth, updatePassword);
router
  .route("/profile/update")
  .put(verifyUserAuth, upload.single("avatar"), updateUserProfile);
router.route("/admin/login").post(loginAdmin);
router
  .route("/admin/users")
  .get(verifyUserAuth, roleBasedAccess("admin"), getUsersList);
router
  .route("/admin/user/:id")
  .get(verifyUserAuth, roleBasedAccess("admin"), getSingleUsersList)
  .put(verifyUserAuth, roleBasedAccess("admin"), updateUserRole)
  .delete(verifyUserAuth, roleBasedAccess("admin"), deleteUser);

export default router;
