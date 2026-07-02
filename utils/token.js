import crypto from "crypto";
import jwt from "jsonwebtoken";

export const createAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
    },
  );
};

export const createRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};
