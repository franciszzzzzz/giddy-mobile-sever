import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";

/**
 * Uploads a buffer to Cloudinary and returns the upload result.
 * @param {Buffer} fileBuffer
 * @param {string} folder
 */
export const uploadToCloudinary = (
  fileBuffer,
  folder = "avatars",
  transformation = {
    width: 500,
    height: 500,
    crop: "fit",
    quality: "auto",
    fetch_format: "auto",
  }
) => {
  return new Promise((resolve, reject) => {
    // Add timeout for upload
    const timeout = setTimeout(() => {
      reject(new Error("Cloudinary upload timeout (90 seconds)"));
    }, 90000);

    const uploadOptions = {
      folder,
      transformation,
      timeout: 90000, // 90 seconds timeout
      chunk_size: 6000000, // 6MB chunks
    };

    console.log(`🟡 Starting Cloudinary upload to folder: ${folder}`);

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        clearTimeout(timeout); // Clear the timeout
        if (error) {
          console.error("❌ Cloudinary upload error:", error.message);
          return reject(error);
        }
        console.log(`✅ Cloudinary upload successful: ${result.public_id}`);
        resolve(result);
      }
    );

    // Handle stream errors
    uploadStream.on("error", (error) => {
      clearTimeout(timeout);
      console.error("❌ Cloudinary stream error:", error);
      reject(error);
    });

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

/**
 * Delete a file from Cloudinary
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    console.log(`🗑️ Attempting to delete from Cloudinary: ${publicId}`);

    // Add timeout for deletion
    const result = await cloudinary.uploader.destroy(publicId, {
      timeout: 30000, // 30 second timeout for deletion
    });

    console.log(`📋 Cloudinary deletion result:`, result);

    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Cloudinary deletion failed: ${result.result}`);
    }

    console.log(`✅ Successfully deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (err) {
    console.error(`❌ Failed to delete ${publicId} from Cloudinary:`, err);
    throw new Error(`Failed to delete image from Cloudinary: ${err.message}`);
  }
};
