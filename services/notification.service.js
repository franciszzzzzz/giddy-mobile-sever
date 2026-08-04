import { Expo } from "expo-server-sdk";
import Notification from "../models/Notification.js";
import DeviceToken from "../models/DeviceToken.js";

const expo = new Expo();

class NotificationService {
  /**
   * Send a notification to a single user.
   */
  async send({ userId, title, body, type = "system", data = {}, push = true }) {
    // Save notification
    const notification = await Notification.create({
      userId,
      title,
      body,
      type,
      data,
      sentAt: new Date(),
    });

    if (!push) {
      return {
        success: true,
        notification,
        tickets: [],
      };
    }

    // Get user's devices
    const devices = await DeviceToken.find({ userId });

    if (!devices.length) {
      return {
        success: true,
        notification,
        tickets: [],
      };
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
        data: {
          notificationId: notification._id.toString(),
          ...data,
        },
      });
    }

    if (!messages.length) {
      return {
        success: true,
        notification,
        tickets: [],
      };
    }

    const chunks = expo.chunkPushNotifications(messages);

    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        console.log("Expo Tickets:", ticketChunk);

        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Expo Push Error:", error);
      }
    }

    // Mark as delivered so we don't re-send it later
    if (tickets.length > 0) {
      notification.deliveredAt = new Date();
      await notification.save();
    }

    return {
      success: true,
      notification,
      tickets,
    };
  }

  /**
   * Deliver notifications that were saved to the DB but never pushed
   * (e.g. a welcome notification created before the user had a device).
   * Called when a device is registered.
   */
  async deliverPendingForUser(userId) {
    const pending = await Notification.find({
      userId,
      deliveredAt: null,
    }).lean();

    if (!pending.length) return { delivered: 0 };

    const devices = await DeviceToken.find({ userId });

    if (!devices.length) return { delivered: 0 };

    const messages = [];

    for (const notification of pending) {
      for (const device of devices) {
        if (!Expo.isExpoPushToken(device.token)) continue;

        messages.push({
          to: device.token,
          sound: "default",
          title: notification.title,
          body: notification.body,
          data: {
            notificationId: notification._id.toString(),
            ...(notification.data || {}),
          },
        });
      }
    }

    if (!messages.length) return { delivered: 0 };

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Expo Pending Push Error:", error);
      }
    }

    // Mark all pending as delivered if any push succeeded
    if (tickets.length > 0) {
      await Notification.updateMany(
        { userId, deliveredAt: null },
        { deliveredAt: new Date() },
      );
    }

    return { delivered: tickets.length };
  }

  /**
   * Broadcast notification to all users.
   */
  async broadcast({ title, body, type = "promotion", data = {} }) {
    // Get all registered devices
    const devices = await DeviceToken.find().lean();

    if (!devices.length) {
      return {
        success: true,
        notificationsCreated: 0,
        tickets: [],
      };
    }

    /**
     * Create ONE notification per user
     */
    const uniqueUsers = [
      ...new Map(devices.map((device) => [device.userId, device])).values(),
    ];

    const notifications = uniqueUsers.map((user) => ({
      userId: user.userId,
      title,
      body,
      type,
      data,
      sentAt: new Date(),
    }));

    const createdNotifications = await Notification.insertMany(notifications);

    /**
     * Send push to EVERY device
     */
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

    if (!messages.length) {
      return {
        success: true,
        notificationsCreated: createdNotifications.length,
        tickets: [],
      };
    }

    const chunks = expo.chunkPushNotifications(messages);

    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        console.log("Expo Broadcast Tickets:", ticketChunk);

        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Expo Broadcast Error:", error);
      }
    }

    return {
      success: true,
      notificationsCreated: createdNotifications.length,
      tickets,
    };
  }
}

export default new NotificationService();
