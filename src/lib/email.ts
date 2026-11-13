 import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailOptions) {
  try {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      throw new Error("Gmail SMTP credentials are not configured.");
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPassword.replace(/\s/g, ""),
      },
    });

    const fromEmail =
      process.env.FROM_EMAIL || `iBUY <${gmailUser}>`;

    const info = await transporter.sendMail({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    console.log("Email accepted by Gmail:", info.messageId);

    return {
      success: true,
      id: info.messageId,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected email error occurred";

    console.error("Email sending failed:", message);

    return {
      success: false,
      error: message,
    };
  }
}

export async function sendOrderConfirmationEmail({
  to,
  customerName,
  orderId,
  totalAmount,
  items,
}: {
  to: string;
  customerName: string;
  orderId: string;
  totalAmount: number;
  items: { title: string; quantity: number; price: number }[];
}) {
  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.title}</td>
      <td>${item.quantity}</td>
      <td>GH₵ ${item.price.toFixed(2)}</td>
    </tr>
  `).join("");

  return sendEmail({
    to,
    subject: `Order Confirmed: #${orderId.slice(-8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <h2>Hi ${customerName},</h2>
        <p>Your payment has been successfully verified.</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <table>${itemsHtml}</table>
        <h3>Total: GH₵ ${totalAmount.toFixed(2)}</h3>
        <p>You can track your order in your iBUY account.</p>
      </div>
    `,
  });
}

export async function sendSellerNotificationEmail({
  to,
  sellerName,
  orderId,
  items,
}: {
  to: string;
  sellerName: string;
  orderId: string;
  items: { title: string; quantity: number; price: number }[];
}) {
  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.title}</td>
      <td>${item.quantity}</td>
      <td>GH₵ ${item.price.toFixed(2)}</td>
    </tr>
  `).join("");

  return sendEmail({
    to,
    subject: `New Order Received: #${orderId.slice(-8).toUpperCase()}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <h2>Hello ${sellerName},</h2>
        <p>You have a new confirmed order!</p>
        <p>Order ID: ${orderId}</p>
        <table>${itemsHtml}</table>
        <p>Please log in to your seller dashboard.</p>
      </div>
    `,
  });
}

export async function sendShippingUpdateEmail({
  to,
  customerName,
  orderId,
  trackingNumber,
  carrier,
  items,
}: {
  to: string;
  customerName: string;
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  items: { title: string; quantity: number }[];
}) {
  const itemsList = items
    .map(item => `<li>${item.quantity}x ${item.title}</li>`)
    .join("");

  const trackingInfo = trackingNumber
    ? `<p>Tracking Number: ${trackingNumber} ${carrier ? `(via ${carrier})` : ""}</p>`
    : "<p>Your seller is preparing your shipment.</p>";

  return sendEmail({
    to,
    subject: `Your order #${orderId.slice(-8).toUpperCase()} has been shipped!`,
    html: `
      <div style="font-family:Arial,sans-serif;">
        <h2>Hi ${customerName},</h2>
        <p>Your order has been shipped.</p>
        ${trackingInfo}
        <ul>${itemsList}</ul>
      </div>
    `,
  });
}

export async function sendDeliveryConfirmationEmail({
  to,
  customerName,
  orderId,
}: {
  to: string;
  customerName: string;
  orderId: string;
}) {
  return sendEmail({
    to,
    subject: `Your order #${orderId.slice(-8).toUpperCase()} has been delivered!`,
    html: `
      <div style="font-family:Arial,sans-serif;">
        <h2>Hi ${customerName},</h2>
        <p>Your order #${orderId.slice(-8).toUpperCase()} has been delivered!</p>
        <p>Thank you for shopping with iBUY.</p>
      </div>
    `,
  });
}

export async function sendSellerApplicationEmail({
  to,
  businessName,
  status,
  reason,
}: {
  to: string;
  businessName: string;
  status: "APPROVED" | "REJECTED" | "MORE_INFORMATION_REQUIRED";
  reason?: string;
}) {
  const messages = {
    APPROVED: {
      subject: "Your iBUY Seller Application Has Been Approved",
      heading: "Congratulations! Your application is approved.",
      message: "Your seller application has been approved.",
    },
    REJECTED: {
      subject: "Update on Your iBUY Seller Application",
      heading: "Your application was not approved.",
      message: "Unfortunately, we cannot approve your application at this time.",
    },
    MORE_INFORMATION_REQUIRED: {
      subject: "Additional Information Required for Your iBUY Application",
      heading: "We need additional information.",
      message: "Please provide the additional information requested by our team.",
    },
  } as const;

  const notification = messages[status];

  return sendEmail({
    to,
    subject: notification.subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
        <h2>${notification.heading}</h2>
        <p>Hello ${businessName},</p>
        <p>${notification.message}</p>
        ${reason ? `<p><strong>Additional details:</strong> ${reason}</p>` : ""}
        <p>Thank you for choosing iBUY.</p>
      </div>
    `,
  });
}

export async function sendEmailVerificationEmail({
  to,
  userId,
  token,
  callbackUrl,
}: {
  to: string;
  userId: string;
  token: string;
  callbackUrl?: string;
}) {
  const configuredUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "");

  if (!configuredUrl) {
    return {
      success: false,
      error: "Application URL is not configured.",
    };
  }

  const baseUrl = new URL(configuredUrl).origin;
  const verificationUrl = new URL("/verify-email", baseUrl);

  verificationUrl.searchParams.set("userId", userId);
  verificationUrl.searchParams.set("token", token);

  if (
    callbackUrl?.startsWith("/") &&
    !callbackUrl.startsWith("//") &&
    !callbackUrl.includes("\\")
  ) {
    verificationUrl.searchParams.set("callbackUrl", callbackUrl);
  }

  return sendEmail({
    to,
    subject: "Verify Your iBUY Email Address",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;">
        <h2>Verify your iBUY account</h2>
        <p>Welcome to iBUY!</p>
        <p>Please verify your email address using the link below.</p>
        <a href="${verificationUrl.toString()}">Verify Email Address</a>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
  });
}