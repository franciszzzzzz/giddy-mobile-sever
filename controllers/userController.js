import crypto from "crypto";
import { wc, wp } from "../config/db.js";
import redisClient from "../config/redis.js";
import handleAsyncError from "../middleware/handleAsyncError.js";
import { CACHE_TTL } from "../utils/cacheUtils.js";
import HandleError from "../utils/handleError.js";
import { sendEmail } from "../utils/sendEmail.js";
import { googleClient } from "../utils/googleClient.js";
import { createAccessToken, createRefreshToken } from "../utils/token.js";
import { log } from "console";
import axios from "axios";
import NotificationService from "../services/notification.service.js";

export const registerUser = handleAsyncError(async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return next(new HandleError("All fields are required", 400));
  }

  try {
    // WooCommerce creates the WordPress customer
    const response = await wc.post("/customers", {
      email,
      username: email,
      first_name: name,
      password,
    });

    const customer = response.data;

    // Send welcome notification (don't let failures affect registration)
    try {
      await NotificationService.send({
        userId: customer.id,
        title: "🎉 Welcome to Giddy & Claire",
        body: `Hi ${customer.first_name}, welcome to Giddy & Claire! We're excited to have you with us.`,
        type: "system",
        data: {
          screen: "Home",
        },
      });
    } catch (error) {
      console.error("Failed to send welcome notification:", error);
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: customer,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error.response?.data || error.message);

    const wcError = error.response?.data;

    if (wcError?.code === "registration-error-email-exists") {
      return next(
        new HandleError("An account with this email already exists.", 409),
      );
    }

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
    console.log(wpUser);

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
      wpUserId: wpUser.user_id,
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
      id: user.id, // WooCommerce customer id
      wpUserId: user.wpUserId, // WordPress user id
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
      // wpToken: wpUser.token,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error.response?.data || error.message);

    return next(new HandleError("Invalid email or password.", 401));
  }
});

export const googleLogin = handleAsyncError(async (req, res, next) => {
  const { idToken } = req.body;

  if (!idToken) {
    return next(new HandleError("Google token is required.", 400));
  }

  //
  // Verify Google Token
  //
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_WEB_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  const email = payload.email;
  const firstName = payload.given_name || payload.name;
  const lastName = payload.family_name || "";
  const picture = payload.picture;

  //
  // Try finding WooCommerce customer
  //
  let customer = null;

  const customerResponse = await wc.get("/customers", {
    params: {
      email,
    },
  });

  if (
    Array.isArray(customerResponse.data) &&
    customerResponse.data.length > 0
  ) {
    customer = customerResponse.data[0];
  }

  //
  // Customer doesn't exist
  // Create one automatically
  //
  let isNewUser = false;

  if (!customer) {
    isNewUser = true;
    const password = crypto.randomUUID();

    const response = await wc.post("/customers", {
      email,
      username: email,
      password,
      first_name: firstName,
      last_name: lastName,
    });

    customer = response.data;

    //
    // Optional Welcome Notification
    //
    try {
      await NotificationService.send({
        userId: customer.id,
        title: "🎉 Welcome to Giddy & Claire",
        body: `Hi ${customer.first_name}, welcome to Giddy & Claire!`,
        type: "system",
        data: {
          screen: "Home",
        },
      });
    } catch (err) {
      console.error(err);
    }
  }

  //
  // Build User
  //
  const user = {
    id: customer.id,
    wpUserId: customer.id,
    email: customer.email,
    firstName: customer.first_name,
    role: customer.role,
    picture,
  };

  //
  // Create App Tokens
  //
  const accessToken = createAccessToken({
    id: user.id,
    wpUserId: user.wpUserId,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
  });

  const refreshToken = createRefreshToken();

  //
  // Remove previous refresh token
  //
  const existingRefresh = await redisClient.get(`user:${user.id}`);

  if (existingRefresh) {
    await redisClient.del(`refresh:${existingRefresh}`);
  }

  //
  // Save Refresh Token
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
  // Map User -> Refresh Token
  //
  await redisClient.setEx(
    `user:${user.id}`,
    CACHE_TTL.REFRESH_TOKEN,
    refreshToken,
  );

  return res.status(200).json({
    success: true,
    message: "Google login successful.",
    user,
    accessToken,
    refreshToken,
    isNewUser,
  });
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
      firstName: req.user.firstName || req.user.email.split("@")[0],
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

// Update User Profile done
export const updateUserProfile = handleAsyncError(async (req, res, next) => {
  const { firstName } = req.body;

  if (!firstName?.trim()) {
    return next(new HandleError("Name is required.", 400));
  }

  // however you currently retrieve it
  const wpToken = await redisClient.get(`wp:${req.user.id}`);

  if (!wpToken) {
    return next(
      new HandleError("WordPress session expired. Please log in again.", 401),
    );
  }

  try {
    const { data } = await axios.post(
      `${process.env.WP_BASE_URL}/wp-json/wp/v2/users/me`,
      {
        first_name: firstName.trim(),
      },
      {
        headers: {
          Authorization: `Bearer ${wpToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        role: data.roles?.[0] || null,
      },
    });
  } catch (error) {
    console.error(
      "UPDATE PROFILE ERROR:",
      error.response?.status,
      error.response?.data || error.message,
    );

    return next(
      new HandleError(
        error.response?.data?.message || "Unable to update profile.",
        error.response?.status || 500,
      ),
    );
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
