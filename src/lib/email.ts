 // src/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder_for_build");

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  try {
    const fromEmail = process.env.FROM_EMAIL || "iBUY <onboarding@resend.dev>";
    
    const data = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    console.log("✅ Email sent successfully:", data.id);
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error("🚨 Failed to send email:", error);
    // Return success: false but don't throw, so payment verification doesn't crash if email fails
    return { success: false, error: error.message };
  }
}


// 👇 ADD THIS: Customer Order Confirmation
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
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.title}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">GH₵ ${item.price.toFixed(2)}</td>
        </tr>
      `
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Hi ${customerName},</h2>
      <p>Thank you for your order! Your payment has been successfully verified.</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; text-align: left;">Item</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding: 8px; text-align: right; font-weight: bold;">Total:</td>
            <td style="padding: 8px; text-align: right; font-weight: bold; color: #16a34a;">GH₵ ${totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <p>You can track your order status in your iBUY account.</p>
    </div>
  `;

  return sendEmail({ 
    to, 
    subject: `Order Confirmed: #${orderId.slice(-8).toUpperCase()}`, 
    html 
  });
}

// 👇 ADD THIS: Seller Notification
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
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.title}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">GH₵ ${item.price.toFixed(2)}</td>
        </tr>
      `
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Hello ${sellerName},</h2>
      <p>You have a new confirmed order!</p>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; text-align: left;">Item</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      <p>Please log in to your seller dashboard to prepare this order for shipment.</p>
    </div>
  `;

  return sendEmail({ 
    to, 
    subject: `New Order Received: #${orderId.slice(-8).toUpperCase()}`, 
    html 
  });
}

// src/lib/email.ts (Add to the bottom)

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
  const itemsList = items.map((item) => `<li>${item.quantity}x ${item.title}</li>`).join("");
  const trackingInfo = trackingNumber 
    ? `<p><strong>Tracking Number:</strong> ${trackingNumber} ${carrier ? `(via ${carrier})` : ""}</p>`
    : "<p>Your seller is preparing your shipment. Tracking info will be updated soon.</p>";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Hi ${customerName},</h2>
      <p>Great news! Your order <strong>#${orderId.slice(-8).toUpperCase()}</strong> has been shipped.</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        ${trackingInfo}
      </div>
      <p><strong>Items in this shipment:</strong></p>
      <ul>${itemsList}</ul>
      <p>You can track your order status anytime in your iBUY account.</p>
    </div>
  `;

  return sendEmail({ 
    to, 
    subject: `Your order #${orderId.slice(-8).toUpperCase()} has been shipped! 🚚`, 
    html 
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
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #16a34a;">Hi ${customerName},</h2>
      <p>Your order <strong>#${orderId.slice(-8).toUpperCase()}</strong> has been marked as <strong>Delivered</strong>! 🎉</p>
      <p>We hope you love your purchase. If you have any issues, please contact the seller or our support team.</p>
      <p style="margin-top: 20px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/account/orders" 
           style="background-color: #16a34a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          View Order & Leave a Review
        </a>
      </p>
    </div>
  `;

  return sendEmail({ 
    to, 
    subject: `Your order #${orderId.slice(-8).toUpperCase()} has been delivered! ✅`, 
    html 
  });
}