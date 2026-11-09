"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, Store } from "lucide-react";

function SellerApplicationForm() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const token = searchParams.get("token") || "";
  const invitationId = searchParams.get("invitationId") || "";

  const hasValidCredential =
    Boolean(token && /^[A-Za-z0-9_-]{43}$/.test(token) && !invitationId) ||
    Boolean(invitationId && !token);

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    description: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [invitationStatus, setInvitationStatus] = useState<
    "checking" | "valid" | "invalid"
  >("checking");
  const [invitationError, setInvitationError] = useState("");

  const credentialQuery = token
    ? `token=${encodeURIComponent(token)}`
    : `invitationId=${encodeURIComponent(invitationId)}`;

  const invitationCallback = `/seller-application?${credentialQuery}`;

  useEffect(() => {
    if (status !== "authenticated" || !session?.user || !hasValidCredential) {
      return;
    }

    let cancelled = false;

    async function validateInvitation() {
      try {
        const response = await fetch(
          `/api/seller/invitation/validate?${credentialQuery}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (cancelled) return;

        if (!response.ok || !data.valid) {
          setInvitationStatus("invalid");
          setInvitationError(
            data.error || "This invitation is no longer valid."
          );
          return;
        }

        setInvitationStatus("valid");
      } catch {
        if (!cancelled) {
          setInvitationStatus("invalid");
          setInvitationError(
            "Unable to validate your invitation. Please try again."
          );
        }
      }
    }

    void validateInvitation();

    return () => {
      cancelled = true;
    };
  }, [status, session, hasValidCredential, credentialQuery]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/seller/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          ...(token ? { token } : { invitationId }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit your application.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasValidCredential) {
    return (
      <MessageCard
        title="Invalid invitation"
        message="This seller invitation link is incomplete or invalid. Please contact the iBUY team for assistance."
      />
    );
  }

  if (status === "loading") {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <MessageCard
        title="Sign in to continue"
        message="This invitation requires an iBUY account. Sign in or create an account using the exact email address to which this invitation was sent."
      >
        <div className="mt-6 grid gap-3">
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(invitationCallback)}`}
            className="rounded-xl bg-orange-600 px-5 py-3 text-center font-semibold text-white hover:bg-orange-700"
          >
            Sign in
          </Link>

          <Link
            href={`/register?callbackUrl=${encodeURIComponent(invitationCallback)}`}
            className="rounded-xl border border-gray-300 px-5 py-3 text-center font-semibold text-gray-800 hover:bg-gray-50"
          >
            Create an account
          </Link>
        </div>
      </MessageCard>
    );
  }

  if (invitationStatus === "checking") {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (invitationStatus === "invalid") {
    return (
      <MessageCard
        title="Invitation unavailable"
        message={invitationError}
      >
        <Link
          href="/account"
          className="mt-6 block rounded-xl border border-gray-300 px-5 py-3 text-center font-semibold text-gray-800 hover:bg-gray-50"
        >
          Return to account
        </Link>
      </MessageCard>
    );
  }

  if (success) {
    return (
      <MessageCard
        title="Application submitted!"
        message="Your seller application has been received. Our team will review it and notify you about the decision."
      >
        <Link
          href="/account"
          className="mt-6 block rounded-xl bg-orange-600 px-5 py-3 text-center font-semibold text-white hover:bg-orange-700"
        >
          Return to account
        </Link>
      </MessageCard>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <Link
        href="/account"
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-orange-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to account
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
            <Store className="h-8 w-8 text-orange-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Become an iBUY Seller
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Complete your business application to start your journey as an
            iBUY seller.
          </p>

          <p className="mt-3 text-xs text-gray-500">
            Signed in as {session.user.email}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-800">
              Business / Store Name *
            </label>

            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={formData.businessName}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  businessName: event.target.value,
                })
              }
              placeholder="e.g. Kwame Electronics"
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-800">
              Business Category *
            </label>

            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={formData.businessType}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  businessType: event.target.value,
                })
              }
              placeholder="e.g. Electronics, Fashion, Food"
              className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-800">
              Tell us about your business *
            </label>

            <textarea
              required
              minLength={10}
              maxLength={2000}
              rows={5}
              value={formData.description}
              onChange={(event) =>
                setFormData({
                  ...formData,
                  description: event.target.value,
                })
              }
              placeholder="What do you sell? Tell us about your business and why customers should choose your store."
              className="w-full resize-y rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3.5 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
            {isLoading ? "Submitting application..." : "Submit Application"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-gray-500">
          Your application will be reviewed by the iBUY team. Seller access
          is granted only after approval.
        </p>
      </div>
    </div>
  );
}

function MessageCard({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
        <Store className="h-8 w-8 text-orange-600" />
      </div>

      <h1 className="text-xl font-bold text-gray-900">{title}</h1>

      <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>

      {children}
    </div>
  );
}

export default function SellerApplicationPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <Suspense
        fallback={
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        }
      >
        <SellerApplicationForm />
      </Suspense>
    </main>
  );
}
