// src/emails/review-request.ts

export function getReviewRequestEmail(params: {
  customerName: string;
  orderId: string;
}): string {
  const { customerName, orderId } = params;
  const shortOrderId = orderId.slice(-8).toUpperCase();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>How was your order?</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 8px;">⭐</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">
                How was your experience?
              </h1>
              <p style="margin: 8px 0 0 0; color: #fef3c7; font-size: 14px;">
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
                Your order has been delivered! We hope you're enjoying your purchase. 
              </p>
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Could you take a quick moment to leave a review? Your feedback helps other customers make great choices and helps our sellers improve.
              </p>

              <!-- Action Button -->
              <table role="presentation" style="border-collapse: collapse; margin: 0 auto 24px auto;">
                <tr>
                  <td style="border-radius: 8px; background-color: #f59e0b;">
                    <a href="${appUrl}/account/orders/${orderId}#review" 
                       style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">
                      Leave a Review →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                It only takes a minute, and it means the world to us!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} iBUY Marketplace. All rights reserved.
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