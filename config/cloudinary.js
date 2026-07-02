import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve("server/config/.env") });

// Validate Cloudinary credentials
if (
  !process.env.CLOUDINARY_NAME ||
  !process.env.API_KEY ||
  !process.env.API_SECRET
) {
  console.error("❌ Missing Cloudinary environment variables");
} else {
  console.log("✅ Cloudinary credentials found");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  // ========== PREVENT TIMEOUTS ==========
  timeout: 120000, // 120 seconds total timeout
  upload_timeout: 120000, // 120 seconds per upload
  chunk_size: 6000000, // 6MB chunks - better for large files
  use_filename: true,
  unique_filename: false,
  overwrite: false,
  secure: true,
});

console.log("✅ Cloudinary configured with timeout settings");

export default cloudinary;
