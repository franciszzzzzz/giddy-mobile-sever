import mongoose from "mongoose";

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    platform: {
      type: String,
      enum: ["android", "ios"],
      required: true,
    },

    deviceName: {
      type: String,
      default: null,
    },

    appVersion: {
      type: String,
      default: null,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Fast lookups for all devices belonging to a user
deviceTokenSchema.index({
  userId: 1,
  platform: 1,
});

export default mongoose.model("DeviceToken", deviceTokenSchema);
