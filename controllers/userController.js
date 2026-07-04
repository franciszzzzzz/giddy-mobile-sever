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

    return next(new HandleError("Registration failed", 500));
  }
});

export const loginUser = handleAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Authenticate against WordPress
    const wpResponse = await wp.post("/wp-json/jwt-auth/v1/token", {
      username: email,
      password,
    });

    const wpUser = wpResponse.data;
    console.log("WP LOGIN RESPONSE:", wpUser);

    if (!wpUser.token) {
      return next(new HandleError("Invalid credentials", 401));
    }

    // Create your own app tokens
    const accessToken = createAccessToken({
      id: wpUser.user_id,
      role: "customer",
      email: wpUser.user_email,
      name: wpUser.user_display_name,
    });

    const refreshToken = createRefreshToken();
    // Check if user already has a refresh token
    const existingRefresh = await redisClient.get(`user:${wpUser.user_id}`);

    if (existingRefresh) {
      await redisClient.del(`refresh:${existingRefresh}`);
    }
    await redisClient.setEx(
      `refresh:${refreshToken}`,
      CACHE_TTL.REFRESH_TOKEN,
      JSON.stringify({
        id: wpUser.user_id,
        role: "customer",
        email: wpUser.user_email,
        name: wpUser.user_display_name,
      }),
    );
    await redisClient.setEx(
      `wp:${wpUser.user_id}`,
      CACHE_TTL.WP_TOKEN,
      wpUser.token,
    );

    await redisClient.setEx(
      `user:${wpUser.user_id}`,
      CACHE_TTL.REFRESH_TOKEN,
      refreshToken,
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: wpUser.user_id,
        email: wpUser.user_email,
        name: wpUser.user_display_name,
        role: "customer",
      },

      wpToken: wpUser.token, // optional, useful for testing
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
  const { refreshToken } = req.body;

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
    return next(new HandleError("Email required", 400));
  }

  try {
    // Generate token

    const resetToken = crypto.randomBytes(32).toString("hex");

    // You can later replace this with WP lookup

    await redisClient.setEx(
      `password-reset:${resetToken}`,

      300,

      email,
    );

    const resetUrl = `${process.env.WP_BASE_URL}/reset-password/${resetToken}`;

    await sendEmail({
      email,

      subject: "Password Reset Request",

      message: `
Reset password here:

${resetUrl}

Expires in 5 minutes.
`,
    });

    return res.json({
      success: true,

      message: "Reset email sent",
    });
  } catch (error) {
    return next(new HandleError("Password reset failed", 500));
  }
});

//Reset Password
export const resetPassword = handleAsyncError(async (req, res, next) => {
  const { token } = req.params;

  const email = await redisClient.get(`password-reset:${token}`);

  if (!email) {
    return next(new HandleError("Invalid token", 400));
  }

  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return next(new HandleError("Passwords do not match", 400));
  }

  // Need WP/WC update here

  const customer = await wc.get(`/customers?email=${email}`);

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
  const token = req.header("Authorization")?.replace("Bearer ", "");

  res.status(200).json({
    success: true,
    user: req.user,
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
  console.log("REQ.USER:", req.user);
  try {
    const response = await wc.put(
      `/customers/${1289}`,
      // `/customers/${req.user.id}`,
      {
        password: newPassword,
      },
      {
        headers: {
          Authorization: `Bearer ${wpToken}`,
        },
      },
    );
    console.log(`/customers/${req.user.id}`);
    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
      customer: response.data,
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
// Update User Profile
export const updateUserProfile = handleAsyncError(async (req, res, next) => {
  const { name, email } = req.body;
  const updateUserDetails = { name, email };

  // ✅ If an image file is uploaded, process it
  if (req.file) {
    const user = await UserModel.findById(req.user.id);

    // 🗑️ Delete old avatar from Cloudinary if it exists
    if (user.avatar && user.avatar.publicId) {
      await deleteFromCloudinary(user.avatar.publicId);
    }

    // ☁️ Upload new image to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, "avatars", {
      width: 500,
      height: 500,
      crop: "fill",
    });

    // 🆕 Update avatar info in DB
    updateUserDetails.avatar = {
      publicId: result.public_id,
      url: result.secure_url,
    };
  }

  // ✏️ Update name/email/avatar in MongoDB
  const user = await UserModel.findByIdAndUpdate(
    req.user.id,
    updateUserDetails,
    { new: true, runValidators: true },
  );

  res.status(200).json({
    success: true,
    message: "User Profile Updated Successfully",
    user,
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
