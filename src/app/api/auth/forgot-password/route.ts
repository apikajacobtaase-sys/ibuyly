// src/app/api/auth/forgot-password/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Resend } from "resend";

// Initialize Resend
 const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key_for_build");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Security: Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true, message: "If an account exists, a code has been sent." });
    }

    // Generate a secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.user.update({
      where: { id: user.id },
      data: { resetOtp: otp, resetOtpExpiry: otpExpiry },
    });

    // 👇 SEND THE REAL EMAIL
    await resend.emails.send({
      from: "iBUY Support <onboarding@resend.dev>", // Works immediately for testing
      to: [email],
      subject: "Your iBUY Verification Code",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #16a34a;">iBUY Password Reset</h2>
          <p>Hello,</p>
          <p>Your 6-digit verification code is:</p>
          <h1 style="letter-spacing: 5px; font-size: 32px; text-align: center; background: #f3f4f6; padding: 15px; border-radius: 8px;">${otp}</h1>
          <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    console.log("✅ Real email sent to:", email);

    return NextResponse.json({ success: true, message: "Code sent successfully." });
  } catch (error: any) {
    console.error("🚨 Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}