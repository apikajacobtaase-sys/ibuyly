// src/app/admin/invite/[token]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";

export default function InviteRedeemPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  // In dev, we might pass the raw token in the URL or via a prompt. 
  // For this implementation, we'll assume the user pastes the token 
  // or it's passed via a query param like ?token=xxx for simplicity in dev.
  const [rawToken, setRawToken] = useState("");

  useEffect(() => {
    // Auto-fill token from URL query param if present (useful for dev testing)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    if (tokenParam) {
      setRawToken(tokenParam);
    }
  }, []);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsRedeeming(true);

    try {
      // We need the invitation ID. In a real email flow, the link would be /admin/invite/[invitationId]?token=[rawToken]
      // For this simplified version, we will fetch the pending invitation for this user's email first, 
      // or we can just ask the user to input the Invitation ID (shown in admin panel).
      // Let's use a prompt for the Invitation ID for this dev flow.
      const invitationId = prompt("Enter the Invitation ID (found in Admin > Staff > Invitations):");
      if (!invitationId) {
        setIsRedeeming(false);
        return;
      }

      const res = await fetch("/api/admin/invitations/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, rawToken }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Role updated successfully! Redirecting to dashboard...");
        setTimeout(() => {
          // Force session update and redirect
          window.location.href = "/admin";
        }, 2000);
      } else {
        setError(data.error || "Failed to redeem invitation");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsRedeeming(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Shield className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">You must be logged in to claim an administrative invitation.</p>
          <button
            onClick={() => signIn(undefined, { callbackUrl: window.location.href })}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Log In to Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-center mb-6">
          <Shield className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Claim Invitation</h2>
          <p className="text-gray-600 mt-2">
            Logged in as: <strong>{session?.user?.email}</strong>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg p-3 mb-4 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleRedeem} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Invitation Token <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={rawToken}
              onChange={(e) => setRawToken(e.target.value)}
              placeholder="Paste the secure token here"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              This token was provided to you by the Super Admin. It is single-use and expires in 48 hours.
            </p>
          </div>

          <button
            type="submit"
            disabled={isRedeeming || !rawToken.trim()}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRedeeming ? "Verifying..." : "Claim Role"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}