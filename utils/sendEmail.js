import nodeMailer from "nodemailer";

export const transporter = nodeMailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  // false because you are not using 465
  secure: false,

  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_PASSWORD,
  },

  tls: {
    rejectUnauthorized: true,
    ciphers: "SSLv3",
  },
});

export const sendEmail = async (options) => {
  const mailOptions = {
    from: process.env.SMTP_MAIL,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(mailOptions);
};
