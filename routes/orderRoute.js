import express from "express";
import { roleBasedAccess, verifyUserAuth } from "../middleware/userAuth.js";
import {
  allMyOrders,
  createNewOrder,
  deleteOrder,
  getAllOrders,
  getSingleOrder,
  updateOrderStatus,
} from "../controllers/orderController.js";

const router = express.Router();

// 🎯 ADD DEBUGGING MIDDLEWARE
router.use((req, res, next) => {
  console.log("🔍 ORDER ROUTE HIT:", req.method, req.url);
  next();
});

// Specific routes first
router.route("/orders/user").get(verifyUserAuth, allMyOrders); // This FIRST
router.route("/new/order").post(verifyUserAuth, createNewOrder);

// Parameter routes last
router.route("/order/:id").get(verifyUserAuth, getSingleOrder); // This LAST

// Admin routes
router
  .route("/admin/orders")
  .get(verifyUserAuth, roleBasedAccess("admin"), getAllOrders);
router
  .route("/admin/order/:id")
  .get(verifyUserAuth, roleBasedAccess("admin"), getSingleOrder)
  .put(verifyUserAuth, roleBasedAccess("admin"), updateOrderStatus)
  .delete(verifyUserAuth, roleBasedAccess("admin"), deleteOrder);

export default router;
