import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email =
      typeof body.email === "string"
        ? body.email.toLowerCase().trim()
        : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    // Prevent email enumeration.
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists, a code has been sent.",
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: {
        resetOtp: otp,
        resetOtpExpiry: otpExpiry,
      },
    });

    const result = await sendEmail({
      to: email,
      subject: "Your iBUY Verification Code",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #16a34a;">iBUY Password Reset</h2>
          <p>Hello,</p>
          <p>Your 6-digit verification code is:</p>
          <h1 style="letter-spacing: 5px; font-size: 32px; text-align: center; background: #f3f4f6; padding: 15px; border-radius: 8px;">
            ${otp}
          </h1>
          <p style="color: #666; font-size: 14px;">
            This code expires in 10 minutes. If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
    });

    if (!result.success) {
      console.error("Password reset email failed:", result.error);

      await db.user.update({
        where: { id: user.id },
        data: {
          resetOtp: null,
          resetOtpExpiry: null,
        },
      });

      return NextResponse.json(
        { error: "Unable to send the verification email. Please try again." },
        { status: 500 }
      );
    }

    console.log("Password reset email sent to:", email);

    return NextResponse.json({
      success: true,
      message: "Code sent successfully.",
    });
  } catch (error: unknown) {
    console.error("Forgot password error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}