// src/emails/welcome-seller.ts

export function getSellerWelcomeEmail(businessName: string, ownerName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to iBUY</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">
                🎉 Welcome to iBUY!
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 22px; font-weight: 700;">
                Hello ${ownerName},
              </h2>
              <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Congratulations! Your seller application for <strong style="color: #111827;">${businessName}</strong> has been officially approved.
              </p>
              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                You can now log in to your seller dashboard, list your products, and start reaching thousands of customers across Ghana.
              </p>

              <!-- Action Button -->
              <table role="presentation" style="border-collapse: collapse; margin: 0 auto 32px auto;">
                <tr>
                  <td style="border-radius: 8px; background-color: #f97316;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/seller" 
                       style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Go to Seller Dashboard →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Quick Tips -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; border: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 700;">
                  💡 Quick Tips for Success:
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
                  <li>Upload high-quality images for your products.</li>
                  <li>Use our <strong>AI Listing Analyzer</strong> to optimize your descriptions.</li>
                  <li>Set up your payout details in the Finance tab.</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                If you have any questions, reply to this email or contact our support team.
              </p>
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