import { Expo } from "expo-server-sdk";
import DeviceToken from "../models/DeviceToken.js";

const expo = new Expo();

/**
 * How long (seconds) a push stays valid if the device is offline.
 *
 * After this window, Expo drops the notification entirely — it never
 * silently lands later. This gives the "pop and gone" behavior you want,
 * similar to WhatsApp, instead of stale messages piling up.
 */
const PUSH_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * Identifier of the Android notification channel the client creates at
 * startup (see client notification.service.ts). The push must reference
 * the same id so Android routes it to a HIGH-importance channel and shows
 * the heads-up banner + sound + vibration instead of a silent tray entry.
 */
const CHANNELS = {
  WELCOME: "welcome",
  ORDERS: "orders",
};

/**
 * Maps a notification "type" (the legacy field callers pass) to the Android
 * channel id. Defaults to the orders channel for anything unrecognized so
 * the notification still pops.
 */
function channelIdForType(type) {
  if (type === "system") return CHANNELS.WELCOME;
  return CHANNELS.ORDERS;
}

/**
 * Builds an Expo push-message object with WhatsApp-style delivery settings.
 *
 * - priority: "high"  → delivered immediately, not batched/delayed
 * - sound: "default"   → plays the device's default notification sound
 * - channelId           → must match the client's setNotificationChannelAsync id
 * - ttl                 → expires after PUSH_TTL_SECONDS if the device is offline
 *
 * @param {Object} params
 * @returns {Object} Expo message
 */
function buildMessage({ to, title, body, data = {}, channelId, ttl = PUSH_TTL_SECONDS }) {
  return {
    to,
    title,
    body,
    sound: "default",
    priority: "high",
    channelId,
    ttl,
    data,
  };
}

/**
 * Sends a batch of push messages through Expo and returns the tickets.
 *
 * Receipts are checked after a short delay so invalid/expired device tokens
 * are pruned from DeviceToken — without this, dead tokens accumulate and
 * silently waste every future send.
 *
 * @param {Array} messages - Expo message objects
 * @returns {Promise<Array>} tickets
 */
async function sendMessages(messages) {
  if (!messages.length) return [];

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

  // Prune invalid tokens in the background — don't block the caller.
  pruneInvalidTokens(tickets, messages).catch((err) =>
    console.error("Receipt check failed:", err),
  );

  return tickets;
}

/**
 * Checks push receipts shortly after sending and deletes device tokens that
 * Expo reports as invalid (uninstalled app, expired token, etc.).
 *
 * Tickets are only readable for ~30 minutes after sending, so this must run
 * promptly. We wait a few seconds first to give Expo time to register the
 * receipt.
 *
 * @param {Array} tickets - tickets returned by sendPushNotificationsAsync
 * @param {Array} messages - the messages that were sent (to map back to tokens)
 */
async function pruneInvalidTokens(tickets, messages) {
  // Build a map of ticketId → token so we know WHICH token failed.
  const ticketTokenMap = new Map();
  let tokenIndex = 0;

  for (const ticket of tickets) {
    if (ticket.id) {
      // Tickets are returned in the same order as the messages in each chunk.
      // Map by position; if a chunk was smaller, tokenIndex keeps running.
      const msg = messages[tokenIndex];
      if (msg) {
        ticketTokenMap.set(ticket.id, msg.to);
      }
    }

    if (ticket.status === "error") {
      // Device-level error (invalid token) — prune immediately.
      const token = ticketTokenMap.get(ticket.id) || messages[tokenIndex]?.to;
      if (token && ticket.details?.error === "DeviceNotRegistered") {
        await DeviceToken.deleteOne({ token }).catch(() => {});
      }
    }

    tokenIndex++;
  }

  // Check receipts for delivery errors (async, best-effort).
  const receiptIds = [];

  for (const ticket of tickets) {
    if (ticket.status === "ok" && ticket.id) {
      receiptIds.push(ticket.id);
    }
  }

  if (!receiptIds.length) return;

  // Give Expo a moment to register the receipts before reading them.
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (const chunk of receiptChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const receiptId of Object.keys(receipts)) {
        const receipt = receipts[receiptId];

        if (receipt.status === "error") {
          const token = ticketTokenMap.get(receiptId);

          if (token && receipt.details?.error === "DeviceNotRegistered") {
            console.log(`Pruning unregistered device token: ${token}`);
            await DeviceToken.deleteOne({ token }).catch(() => {});
          }

          console.error(`Push receipt error:`, receipt.message, receipt.details);
        }
      }
    } catch (error) {
      console.error("Receipt fetch error:", error);
    }
  }
}

class NotificationService {
  /**
   * Sends an ephemeral push notification to all of a user's devices.
   *
   * No database record is created — the notification pops on the phone
   * (sound + heads-up banner via HIGH-importance channel) and expires after
   * PUSH_TTL_SECONDS if the device is offline.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.title
   * @param {string} params.body
   * @param {string} [params.type="system"] - controls the Android channel
   * @param {Object} [params.data={}] - deep-link payload (screen, orderId, ...)
   * @returns {Promise<Object>} { success, tickets }
   */
  async send({ userId, title, body, type = "system", data = {} }) {
    const devices = await DeviceToken.find({ userId });

    if (!devices.length) {
      return { success: true, tickets: [] };
    }

    const channelId = channelIdForType(type);
    const messages = [];

    for (const device of devices) {
      if (!Expo.isExpoPushToken(device.token)) {
        console.warn(`Invalid Expo Push Token: ${device.token}`);
        continue;
      }

      messages.push(buildMessage({ to: device.token, title, body, data, channelId }));
    }

    if (!messages.length) {
      return { success: true, tickets: [] };
    }

    const tickets = await sendMessages(messages);

    return { success: true, tickets };
  }

  /**
   * Broadcasts an ephemeral push notification to every registered device.
   * Kept for potential future use (promotions, announcements).
   *
   * @param {Object} params
   * @param {string} params.title
   * @param {string} params.body
   * @param {string} [params.type="promotion"]
   * @param {Object} [params.data={}]
   * @returns {Promise<Object>} { success, tickets }
   */
  async broadcast({ title, body, type = "promotion", data = {} }) {
    const devices = await DeviceToken.find().lean();

    if (!devices.length) {
      return { success: true, tickets: [] };
    }

    const channelId = channelIdForType(type);
    const messages = [];

    for (const device of devices) {
      if (!Expo.isExpoPushToken(device.token)) {
        console.warn(`Invalid Expo Push Token: ${device.token}`);
        continue;
      }

      messages.push(buildMessage({ to: device.token, title, body, data, channelId }));
    }

    if (!messages.length) {
      return { success: true, tickets: [] };
    }

    const tickets = await sendMessages(messages);

    return { success: true, tickets };
  }
}

export default new NotificationService();
