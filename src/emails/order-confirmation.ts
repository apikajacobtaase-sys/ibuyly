// src/emails/order-confirmation.ts

interface OrderItem {
  title: string;
  quantity: number;
  price: number;
  imageUrl?: string | null;
}

export function getOrderConfirmationEmail(params: {
  customerName: string;
  orderId: string;
  items: OrderItem[];
  totalAmount: number;
  shippingAddress: string;
}): string {
  const { customerName, orderId, items, totalAmount, shippingAddress } = params;
  const shortOrderId = orderId.slice(-8).toUpperCase();
 // âœ… NUCLEAR FIX: Hardcode the live Vercel URL to guarantee no localhost fallback
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 60px; vertical-align: top;">
              ${item.imageUrl 
                ? `<img src="${item.imageUrl}" alt="${item.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb;" />`
                : `<div style="width: 50px; height: 50px; background-color: #f3f4f6; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px;">ðŸ“¦</div>`
              }
            </td>
            <td style="padding-left: 12px; vertical-align: top;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">${item.title}</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #6b7280;">Qty: ${item.quantity}</p>
            </td>
            <td style="text-align: right; vertical-align: top; font-size: 14px; font-weight: 600; color: #111827;">
              GHâ‚µ ${(item.price * item.quantity).toFixed(2)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 8px;">âœ…</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">
                Order Confirmed!
              </h1>
              <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 14px;">
                Order #${shortOrderId}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Hi ${customerName},
              </p>
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thank you for your purchase! We've received your order and are getting it ready.
              </p>

              <!-- Items List -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                  Order Summary
                </h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${itemsHtml}
                </table>
                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 12px; padding-top: 12px; border-top: 2px solid #e5e7eb;">
                  <tr>
                    <td style="font-size: 16px; font-weight: 700; color: #111827;">Total</td>
                    <td style="text-align: right; font-size: 18px; font-weight: 800; color: #f97316;">
                      GHâ‚µ ${totalAmount.toFixed(2)}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Shipping Address -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                  Shipping To
                </h3>
                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5;">
                  ${shippingAddress}
                </p>
              </div>

              <!-- Action Button -->
              <table role="presentation" style="border-collapse: collapse; margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background-color: #111827;">
                    <a href="${appUrl}/account/orders/${orderId}" 
                       style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">
                      Track Your Order â†’
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Â© ${new Date().getFullYear()} iBUY Marketplace. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

