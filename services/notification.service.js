import { Expo } from "expo-server-sdk";
import Notification from "../models/Notification.js";
import DeviceToken from "../models/DeviceToken.js";

const expo = new Expo();

class NotificationService {
  async send({ userId, title, body, type = "system", data = {} }) {
    // 1. Save notification to MongoDB
    const notification = await Notification.create({
      userId,
      title,
      body,
      type,
      data,
      sentAt: new Date(),
    });

    // 2. Find all user's devices
    const devices = await DeviceToken.find({ userId });

    if (!devices.length) {
      return notification;
    }

    const messages = [];

    for (const device of devices) {
      if (!Expo.isExpoPushToken(device.token)) {
        console.warn(`Invalid Expo Push Token: ${device.token}`);
        continue;
      }

      messages.push({
        to: device.token,
        sound: "default",
        title,
        body,
        data,
      });
    }

    // 3. Send notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error("Expo Push Error:", error);
      }
    }

    return notification;
  }
}

export default new NotificationService();
