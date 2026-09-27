import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

let transporter: ReturnType<
  typeof nodemailer.createTransport
> | null = null;

async function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (
    process.env.ETHEREAL_USER &&
    process.env.ETHEREAL_PASS
  ) {
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
      },
    });
  } else {
    const testAccount =
      await nodemailer.createTestAccount();

    console.log("📧 Ethereal account created:");
    console.log("User:", testAccount.user);

    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return transporter;
}

export async function sendEmail(
  from: string,
  to: string,
  subject: string,
  text: string
) {
  const mailer = await getTransporter();

  const info = await mailer.sendMail({
    from,
    to,
    subject,
    text,
  });

  const previewUrl =
    nodemailer.getTestMessageUrl(info);

  console.log("📨 Email sent successfully");
  console.log(
    "Message ID:",
    info.messageId
  );

  if (previewUrl) {
    console.log(
      "🔗 Ethereal preview:",
      previewUrl
    );
  }

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || null,
  };
}