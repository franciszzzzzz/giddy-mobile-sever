import dotenv from "dotenv";
import path from "path";
import redisClient from "./config/redis.js"; // <-- Import the Redis client

dotenv.config({ path: path.resolve("config/.env") });

const { connectMongoDb } = await import("./config/db.js");
const { default: app } = await import("./app.js");

await connectMongoDb();

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`server is running on ${PORT}`);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(err.message);
  process.exit(1);
});

// Handle unhandled rejections
process.on("unhandledRejection", (err) => {
  console.log(err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      // Close MongoDB
      await mongoose.connection.close();
      console.log("MongoDB disconnected");

      // Close Redis
      await redisClient.disconnect(); // <-- Clean Redis disconnect
    } catch (err) {
      console.error("Error during shutdown:", err);
    }

    process.exit(0);
  });
}

// Handle both SIGTERM (cloud environments) and SIGINT (local Ctrl+C)
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
