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
    console.log(`[WELCOME] First device for user ${userId} — sending welcome push...`);

    try {
      const welcomeResult = await NotificationService.send({
        userId,
        title: "🎉 Welcome to Giddy & Claire",
        body: `Welcome to Giddy & Claire! We're excited to have you with us.`,
        type: "system",
        data: {
          screen: "Home",
        },
      });

      console.log("[WELCOME] Push result:", JSON.stringify(welcomeResult, null, 2));
    } catch (error) {
      console.error("[WELCOME] Failed to send welcome notification:", error);
    }
  } else {
    console.log(
      `[WELCOME] User ${userId} already has a device — skipping welcome push.`,
    );
  }

  res.status(201).json({
    success: true,
    message: "Device token registered.",
  });
});

export const sendTestNotification = handleAsyncError(async (req, res) => {
  const userId = req.user.id;

  //
  // Diagnostic test endpoint.
  //
  // Unlike the real flows (welcome / payment), this returns a full diagnostic
  // report so we can see exactly WHERE the push chain breaks:
  //   1. Does the user have a device token?
  //   2. Is the token a valid Expo push token?
  //   3. Did Expo accept the push (ticket status)?
  //
  const devices = await DeviceToken.find({ userId }).lean();

  if (!devices.length) {
    return res.status(200).json({
      success: false,
      delivered: false,
      reason: "NO_DEVICE_TOKEN",
      message:
        "No device token found for this user. The client never called " +
        "/notifications/register-token, so there is nowhere to send the push.",
      deviceCount: 0,
    });
  }

  const result = await NotificationService.send({
    userId,
    title: "🧪 Test Notification",
    body: "If you can see this, push notifications are working!",
    type: "system",
    data: {
      screen: "Home",
    },
  });

  // Classify the tickets so the response is self-explanatory.
  const ticketSummary = (result.tickets || []).map((ticket) => ({
    status: ticket.status,
    message: ticket.message,
    error: ticket.details?.error,
    ticketId: ticket.id,
  }));

  const anyError = ticketSummary.some((t) => t.status === "error");
  const anyOk = ticketSummary.some((t) => t.status === "ok");

  let reason = null;

  if (anyError && !anyOk) reason = "EXPO_REJECTED_THE_PUSH";
  else if (anyError && anyOk) reason = "PARTIAL_SUCCESS";

  res.status(200).json({
    success: true,
    delivered: anyOk,
    reason,
    deviceCount: devices.length,
    devices: devices.map((d) => ({
      platform: d.platform,
      tokenPreview: d.token.slice(0, 25) + "...",
      lastUsedAt: d.lastUsedAt,
    })),
    tickets: ticketSummary,
    message: anyOk
      ? "Push sent to Expo. If it doesn't arrive on the phone, the issue is " +
        "FCM/APNs credentials or the device itself."
      : "Expo rejected the push — see the ticket details.",
  });
});
