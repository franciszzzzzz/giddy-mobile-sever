import DeviceToken from "../models/DeviceToken.js";
import HandleError from "../utils/handleError.js";
import handleAsyncError from "../middleware/handleAsyncError.js";
import NotificationService from "../services/notification.service.js";

export const registerDeviceToken = handleAsyncError(async (req, res, next) => {
  const { token, platform, deviceName, appVersion } = req.body;

  if (!token || !platform) {
    return next(new HandleError("Token and platform are required.", 400));
  }

  const userId = req.user.id;

  const existingToken = await DeviceToken.findOne({ token });

  if (existingToken) {
    existingToken.userId = userId;
    existingToken.platform = platform;
    existingToken.deviceName = deviceName;
    existingToken.appVersion = appVersion;
    existingToken.lastUsedAt = new Date();

    await existingToken.save();

    return res.status(200).json({
      success: true,
      message: "Device token updated.",
    });
  }

  await DeviceToken.create({
    userId,
    token,
    platform,
    deviceName,
    appVersion,
  });

  res.status(201).json({
    success: true,
    message: "Device token registered.",
  });
});

export const sendTestNotification = handleAsyncError(async (req, res) => {
  const notification = await NotificationService.send({
    userId: req.user.id,
    title: "🎉 Welcome to Giddy & Claire",
    body: "Congratulations! Your push notifications are working.",
    type: "system",
    data: {
      screen: "Home",
    },
  });

  res.status(200).json({
    success: true,
    message: "Test notification sent.",
    notification,
  });
});
