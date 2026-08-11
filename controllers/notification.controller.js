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

  // Check if this is the user's FIRST device — if so, they're a new user
  // (or first login on a new device) and should get a welcome notification.
  // We check BEFORE creating the new token so the count reflects prior state.
  const isFirstDevice = (await DeviceToken.countDocuments({ userId })) === 0;

  await DeviceToken.create({
    userId,
    token,
    platform,
    deviceName,
    appVersion,
  });

  // Send the welcome push now that we know the device exists. This fires at
  // the exact moment the token is registered, so send() will actually find a
  // device and deliver the push. Only on first registration — not every login.
  if (isFirstDevice) {
    try {
      await NotificationService.send({
        userId,
        title: "🎉 Welcome to Giddy & Claire",
        body: `Welcome to Giddy & Claire! We're excited to have you with us.`,
        type: "system",
        data: {
          screen: "Home",
        },
      });
    } catch (error) {
      console.error("Failed to send welcome notification:", error);
    }
  }

  res.status(201).json({
    success: true,
    message: "Device token registered.",
  });
});

export const sendTestNotification = handleAsyncError(async (req, res) => {
  const result = await NotificationService.send({
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
    tickets: result.tickets,
  });
});
