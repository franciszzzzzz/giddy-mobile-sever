import jwt from "jsonwebtoken";
import HandleError from "../utils/handleError.js";
import handleAsyncError from "./handleAsyncError.js";

export const verifyUserAuth = handleAsyncError(async (req, res, next) => {
  const token =
    req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return next(new HandleError("Please login to access this resource.", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    req.user = {
      id: decoded.id,
      wpUserId: decoded.wpUserId,
      role: decoded.role,
      email: decoded.email,
      firstName: decoded.firstName,
    };

    next();
  } catch (error) {
    console.log("JWT ERROR:", error.message);

    return next(new HandleError("Invalid or expired token.", 401));
  }
});
export const roleBasedAccess = (...roles) => {
  return (req, res, next) => {
    // ✅ ADD THIS: Check if req.user exists
    if (!req.user) {
      console.log("❌ roleBasedAccess: req.user is undefined");
      return next(
        new HandleError("Authentication required. Please log in.", 401),
      );
    }

    // ✅ ADD THIS: Check if req.user.role exists
    if (!req.user.role) {
      console.log("❌ roleBasedAccess: req.user.role is undefined");
      return next(
        new HandleError(
          "User role not found. Please contact administrator.",
          403,
        ),
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new HandleError(
          `Role - ${req.user.role} isn't allowed to access this resource`,
          403,
        ),
      );
    }
    next();
  };
};
