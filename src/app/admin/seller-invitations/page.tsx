"use client";

import { FormEvent, useState } from "react";
import {
  MailPlus,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
} from "lucide-react";

export default function SellerInvitationsPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; emailSent: boolean; inAppNotificationSent: boolean; invitationUrl: string; expiresAt: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Enter the customer's email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/seller-invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to send seller invitation.");
      }

      setResult({
        email: data.invitation.email,
        emailSent: data.emailSent,
        inAppNotificationSent: data.inAppNotificationSent,
        invitationUrl: data.invitation.invitationUrl,
        expiresAt: data.invitation.expiresAt,
      });
      setEmail("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "A network error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
          <MailPlus className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Seller Invitations
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Invite customers to apply for a seller account on iBUY.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <h2 className="text-sm font-semibold text-indigo-900">
              Invitation-only seller onboarding
            </h2>
            <p className="mt-1 text-sm leading-6 text-indigo-800">
              Customers must receive an invitation before they can submit a
              seller application. They must sign in or register using the
              exact email address you invite.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Send a seller invitation
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter the customer's email address. iBUY will send the invitation
            link automatically.
          </p>
        </div>

        <div>
          <label
            htmlFor="seller-email"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Customer email address
          </label>
          <input
            id="seller-email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="customer@example.com"
            className="min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div
            role="status"
            className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  Invitation created for {result.email}
                </p>
                <p className="mt-1">
                  Email delivery: {result.emailSent ? "Sent successfully" : "Failed"}
                </p>
                <p>
                  In-app notification: {result.inAppNotificationSent ? "Delivered" : "Not delivered (or no existing account)"}
                </p>
                <p className="mt-1 text-xs">
                  Expires: {new Date(result.expiresAt).toLocaleString()}
                </p>
              </div>
            </div>

            {!result.emailSent && (
              <div className="space-y-2 border-t border-emerald-200 pt-3">
                <p className="font-medium">
                  Share this invitation link manually:
                </p>
                <a
                  href={result.invitationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all text-emerald-700 underline"
                >
                  {result.invitationUrl}
                </a>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <Send className="h-4 w-4" />
          {loading ? "Sending invitation..." : "Send invitation"}
        </button>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Invitation validity
            </h3>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Each invitation expires after 48 hours and can only be used
              once. Sending a new invitation to the same email revokes its
              previous active invitation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
