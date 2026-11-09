"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";

type VerificationStatus = "loading" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const submitted = useRef(false);

  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  const userId = searchParams.get("userId");
  const token = searchParams.get("token");
  const rawCallbackUrl = searchParams.get("callbackUrl");

  const callbackUrl =
    rawCallbackUrl &&
    rawCallbackUrl.startsWith("/") &&
    !rawCallbackUrl.startsWith("//") &&
    !rawCallbackUrl.includes("\\")
      ? rawCallbackUrl
      : "/account";

  useEffect(() => {
    if (submitted.current) return;

    if (!userId || !token) {
      setStatus("error");
      setMessage("This verification link is incomplete or invalid.");
      return;
    }

    submitted.current = true;

    async function verifyEmail() {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId, token }),
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setMessage(
            data.error || "Email verification failed. Please request a new link."
          );
          return;
        }

        setStatus("success");
        setMessage("Your email address has been verified successfully.");
      } catch {
        setStatus("error");
        setMessage("Unable to verify your email. Please check your connection and try again.");
      }
    }

    void verifyEmail();
  }, [userId, token]);

  const signInUrl = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm sm:p-9">
        <div className="mb-5 flex justify-center">
          {status === "loading" && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          )}

          {status === "success" && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
          )}

          {status === "error" && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <XCircle className="h-9 w-9 text-red-600" />
            </div>
          )}
        </div>

        <div className="mb-2 flex items-center justify-center gap-2">
          <MailCheck className="h-5 w-5 text-orange-600" />
          <span className="text-sm font-bold tracking-wide text-orange-600">
            iBUY
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">
          {status === "loading"
            ? "Verifying your email"
            : status === "success"
              ? "Email verified!"
              : "Verification failed"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          {message}
        </p>

        {status === "success" && (
          <Link
            href={signInUrl}
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-700"
          >
            Continue to sign in
          </Link>
        )}

        {status === "error" && (
          <Link
            href="/login"
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white transition hover:bg-gray-800"
          >
            Go to sign in
          </Link>
        )}

        {status === "loading" && (
          <p className="mt-6 text-xs text-gray-400">
            Please keep this page open while we verify your address.
          </p>
        )}
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}