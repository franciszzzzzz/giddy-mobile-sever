import dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.resolve("server/config/.env"),
});
// const { connectMongoDB } = await import("./config/db.js");
// const { transporter } = await import("./utils/sendEmail.js");
const { default: app } = await import("./app.js");

// connectMongoDB();

// transporter.verify((error) => {
//   if (error) {
//     console.error("SMTP CONNECTION FAILED:", error);
//   } else {
//     console.log("SMTP READY");
//   }
// });

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`server is running on ${PORT}`);
});

process.on("uncaughtException", (err) => {
  console.log(err.message);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.log(err.message);

  server.close(() => {
    process.exit(1);
  });
});
