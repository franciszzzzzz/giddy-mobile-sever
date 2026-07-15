import crypto from "crypto";
import { wc, wp } from "../config/db.js";
import redisClient from "../config/redis.js";
import handleAsyncError from "../middleware/handleAsyncError.js";
import { CACHE_TTL } from "../utils/cacheUtils.js";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../utils/cloudinaryService.js";
import HandleError from "../utils/handleError.js";
import { sendEmail } from "../utils/sendEmail.js";
import { createAccessToken, createRefreshToken } from "../utils/token.js";

//register user
export const registerUser = handleAsyncError(async (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return next(new HandleError("All fields are required", 400));
  }

  try {
    // WooCommerce creates WP customer
    const response = await wc.post("/customers", {
      email,
      username: email,
      first_name: name,
      password,
    });

    return res.status(201).json({
      success: true,

      message: "User registered successfully",

      user: response.data,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error.response?.data || error.message);

    const wcError = error.response?.data;

    // Email already exists
    if (wcError?.code === "registration-error-email-exists") {
      return next(
        new HandleError("An account with this email already exists.", 409),
      );
    }

    // Username already exists
    if (wcError?.code === "registration-error-username-exists") {
      return next(
        new HandleError("An account with this email already exists.", 409),
      );
    }

    return next(
      new HandleError(
        wcError?.message || "Registration failed.",
        error.response?.status || 500,
      ),
    );
  }
});

export const loginUser = handleAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  try {
    //
    // Authenticate with WordPress
    //
    const wpResponse = await wp.post("/wp-json/jwt-auth/v1/token", {
      username: email,
      password,
    });

    const wpUser = wpResponse.data;

    if (!wpUser.token) {
      return next(new HandleError("Invalid email or password.", 401));
    }

    //
    // Try fetching WooCommerce customer
    //
    let customer = null;

    try {
      const customerResponse = await wc.get("/customers", {
        params: {
          email: wpUser.user_email,
        },
      });

      if (
        Array.isArray(customerResponse.data) &&
        customerResponse.data.length > 0
      ) {
        customer = customerResponse.data[0];
      }
    } catch (err) {
      console.error(
        "Failed to fetch WooCommerce customer:",
        err.response?.data || err.message,
      );
    }

    //
    // Build unified user object
    //
    const user = {
      id: customer?.id || wpUser.user_id,

      email: customer?.email || wpUser.user_email,

      firstName:
        customer?.first_name ||
        wpUser.user_display_name ||
        wpUser.user_nicename ||
        wpUser.user_email.split("@")[0],

      role: customer?.role || wpUser.role,
    };

    //
    // Create App Tokens
    //
    const accessToken = createAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
    });

    const refreshToken = createRefreshToken();

    //
    // Remove old refresh token if it exists
    //
    const existingRefresh = await redisClient.get(`user:${user.id}`);

    if (existingRefresh) {
      await redisClient.del(`refresh:${existingRefresh}`);
    }

    //
    // Store refresh token
    //
    await redisClient.setEx(
      `refresh:${refreshToken}`,
      CACHE_TTL.REFRESH_TOKEN,
      JSON.stringify({
        id: user.id,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
      }),
    );

    //
    // Store WordPress token
    //
    await redisClient.setEx(`wp:${user.id}`, CACHE_TTL.WP_TOKEN, wpUser.token);

    //
    // Map user -> refresh token
    //
    await redisClient.setEx(
      `user:${user.id}`,
      CACHE_TTL.REFRESH_TOKEN,
      refreshToken,
    );

    //
    // Response
    //
    return res.status(200).json({
      success: true,
      message: "Login successful",

      user,

      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error.response?.data || error.message);

    return next(new HandleError("Invalid email or password.", 401));
  }
});

// REFRESH ACCESS TOKEN
export const refreshAccessToken = handleAsyncError(async (req, res, next) => {
  const refreshToken = req.header("Authorization")?.replace("Bearer ", "");

  if (!refreshToken) {
    return next(new HandleError("Refresh token required", 401));
  }

  const user = await redisClient.get(`refresh:${refreshToken}`);

  if (!user) {
    return next(new HandleError("Invalid refresh token", 401));
  }

  const parsedUser = JSON.parse(user);

  const accessToken = createAccessToken(parsedUser);

  return res.status(200).json({
    success: true,
    accessToken,
  });
});

// (NOT YET TESTED)Admin Login Only - RESTRICTS to admins only I havent tried this out yet
export const loginAdmin = handleAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const wpResponse = await wc.post("/wp-json/jwt-auth/v1/token", {
      username: email,
      password,
    });
    if (!wpResponse.data.token) {
      return next(new HandleError("Invalid credentials", 401));
    }

    const user = {
      id: wpResponse.data.user_id,

      email: wpResponse.data.user_email,
    };

    // You need a WP endpoint
    // to return roles here

    if (user.role !== "administrator") {
      return next(new HandleError("Admin access denied", 403));
    }

    const accessToken = createAccessToken(user);

    const refreshToken = createRefreshToken();

    await redisClient.setEx(
      `refresh:${refreshToken}`,

      CACHE_TTL.REFRESH_TOKEN,

      user.id.toString(),
    );

    return res.json({
      success: true,

      accessToken,
    });
  } catch (error) {
    return next(new HandleError("Admin login failed", 401));
  }
});

// Logout User
export const logoutUser = handleAsyncError(async (req, res, next) => {
  const refreshToken = req.header("Authorization")?.replace("Bearer ", "");

  if (!refreshToken) {
    return next(new HandleError("Refresh token required.", 401));
  }

  const session = await redisClient.get(`refresh:${refreshToken}`);

  // User is already logged out or token is invalid
  if (!session) {
    return res.status(200).json({
      success: true,
      message: "User is already logged out.",
    });
  }

  const user = JSON.parse(session);

  await redisClient.del(`refresh:${refreshToken}`);

  // Only delete the user mapping if an id exists
  if (user?.id) {
    await redisClient.del(`user:${user.id}`);
  }

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
});
// REQUEST PASSWORD RESET
export const requestPasswordReset = handleAsyncError(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new HandleError("Please provide an email address", 400));
  }

  try {
    await wp.post("wp-json/mobile/v1/request-password-reset", {
      email,
    });

    return res.status(200).json({
      success: true,
      message:
        "If an account exists for this email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error(
      "❌ Password Reset Error:",
      error.response?.data || error.message,
    );

    return next(
      new HandleError("Unable to process password reset request", 500),
    );
  }
});

//Reset Password
export const resetPassword = handleAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const email = await redisClient.get(`password-reset:${token}`);
  console.log("EMAIL FROM REDIS:", email);
  if (!email) {
    return next(new HandleError("Invalid token", 400));
  }

  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return next(new HandleError("Passwords do not match", 400));
  }
  // const customer = await wc.get("/customers", {
  //   params: {
  //     email,
  //   },
  // });
  try {
    const response = await wc.get("/customers");

    console.log(response.data);
  } catch (err) {
    console.log(err.response?.status);
    console.log(err.response?.data);
  }
  //console.log(customer.data);
  const user = customer.data[0];

  if (!user) {
    return next(new HandleError("User not found", 404));
  }

  await wc.put(
    `/customers/${user.id}`,

    {
      password,
    },
  );

  await redisClient.del(`password-reset:${token}`);

  return res.json({
    success: true,
    message: "Password updated",
  });
});

// Get user Details
export const getUserDetails = handleAsyncError(async (req, res, next) => {
  let user = null;

  try {
    // Try WooCommerce customer first
    const response = await wc.get(`/customers/${req.user.id}`);

    const customer = response.data;

    user = {
      id: customer.id,
      email: customer.email,
      firstName:
        customer.first_name ||
        customer.username ||
        customer.email.split("@")[0],
      lastName: customer.last_name || "",
      role: customer.role,
    };
  } catch (err) {
    // Not a WooCommerce customer
    user = {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.name || req.user.email.split("@")[0],
      lastName: "",
      role: req.user.role,
    };
  }

  return res.status(200).json({
    success: true,
    user,
  });
});

// Update User Password
export const updatePassword = handleAsyncError(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return next(
      new HandleError("Old password and new password are required.", 400),
    );
  }

  const wpToken = await redisClient.get(`wp:${req.user.id}`);

  if (!wpToken) {
    return next(
      new HandleError("WordPress session expired. Please log in again.", 401),
    );
  }

  try {
    const response = await wp.post(
      "/wp-json/mobile/v1/change-password",
      {
        current_password: oldPassword,
        new_password: newPassword,
      },
      {
        headers: {
          Authorization: `Bearer ${wpToken}`,
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: response.data?.message || "Password updated successfully.",
    });
  } catch (error) {
    console.error(
      "PASSWORD UPDATE ERROR:",
      error.response?.data || error.message,
    );

    return next(
      new HandleError(
        error.response?.data?.message || "Unable to update password.",
        error.response?.status || 400,
      ),
    );
  }
});

// Update User Profile not done
export const updateUserProfile = handleAsyncError(async (req, res, next) => {
  const { firstName, lastName, email } = req.body;

  const updateData = {
    first_name: firstName,
    last_name: lastName,
    email,
  };

  const response = await wc.put(`/customers/${req.user.id}`, updateData);

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user: response.data,
  });
});

//Admin Getting User Information
export const getUsersList = handleAsyncError(async (req, res, next) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Get total count without limit (not capped)
  const totalUsers = await UserModel.countDocuments();
  const users = await UserModel.find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const token = req.cookies.token;
  res.status(200).json({
    success: true,
    users,
    totalUsers,
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(totalUsers / limit)),
    resultPerPage: limit,
    token,
  });
});

//Admin Getting Single Users Information
export const getSingleUsersList = handleAsyncError(async (req, res, next) => {
  const { id } = req.params;
  console.log(id);
  const user = await UserModel.findById(id);
  if (!user) {
    return next(new HandleError(`User doesn't exist with this ${id}`, 400));
  }
  res.status(200).json({
    success: true,
    user,
  });
});

// Admin Changing User Role
export const updateUserRole = handleAsyncError(async (req, res, next) => {
  const { role } = req.body;
  const { id } = req.params;
  const newUserData = {
    role,
  };
  const user = await UserModel.findByIdAndUpdate(id, newUserData, {
    new: true,
    runValidators: true,
  });
  if (!user) {
    return next(new HandleError("User Doesn't Exist", 400));
  }
  res.status(200).json({
    success: true,
    user,
  });
});

// Delete User Profile - By Admin
export const deleteUser = handleAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1️⃣ Find the user first
    const user = await UserModel.findById(id);
    if (!user) {
      return next(new HandleError("User Not Found", 404));
    }

    console.log(`🔍 Found user: ${user.name}`);
    console.log(`🖼️ User avatar:`, user.avatar);

    // 2️⃣ Delete Cloudinary avatar if it exists - ✅ FIXED: use publicId (camelCase)
    if (user.avatar && user.avatar.publicId) {
      console.log(
        `🧹 Deleting user avatar from Cloudinary: ${user.avatar.publicId}`,
      );
      await deleteFromCloudinary(user.avatar.publicId);
    } else {
      console.log("ℹ️ No avatar found for this user or missing publicId.");
    }

    // 3️⃣ Delete the user document from the database
    await UserModel.findByIdAndDelete(id);
    console.log("✅ User deleted from database");

    // 4️⃣ Send response
    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      user,
    });
  } catch (error) {
    console.error("❌ Error in deleteUser:", error);
    return next(new HandleError("Failed to delete user", 500));
  }
});

// GET /api/v1/health
export const healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is awake",
    timestamp: Date.now(),
  });
};
