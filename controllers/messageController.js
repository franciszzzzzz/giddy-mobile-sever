import Message from "../models/messageModel.js";
import handleAsyncError from "../middleware/handleAsyncError.js";
import ErrorHandler from "../utils/handleError.js";

export const createMessage = handleAsyncError(async (req, res, next) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    return next(new ErrorHandler("All fields are required", 400));
  }
  const doc = await Message.create({ name, email, message });
  res
    .status(201)
    .json({ success: true, message: "Message received", data: doc });
});

export const getMessages = handleAsyncError(async (req, res, next) => {
  const { page = 1, limit = 20, q } = req.query;
  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { message: { $regex: q, $options: "i" } },
        ],
      }
    : {};
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Message.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items,
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

export const markRead = handleAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const doc = await Message.findByIdAndUpdate(
    id,
    { read: true },
    { new: true }
  );
  if (!doc) return next(new ErrorHandler("Message not found", 404));
  res.json({ success: true, data: doc });
});

export const deleteMessage = handleAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const doc = await Message.findByIdAndDelete(id);
  if (!doc) return next(new ErrorHandler("Message not found", 404));
  res.json({ success: true, message: "Deleted" });
});
