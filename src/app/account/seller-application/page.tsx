"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  MessageSquareText,
} from "lucide-react";

type QuestionType = "SHORT_ANSWER" | "LONG_ANSWER" | "TRUE_FALSE";

interface RequestedQuestion {
  id: string;
  question: string;
  type: QuestionType;
}

interface SubmittedAnswer {
  questionId: string;
  value: string | boolean;
}

interface SellerApplication {
  id: string;
  businessName: string;
  businessType: string | null;
  description: string | null;
  status: string;
  adminNotes: string | null;
  rejectionReason: string | null;
  requestedQuestions: RequestedQuestion[];
  submittedAnswers: SubmittedAnswer[] | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
}

const statusDetails: Record<
  string,
  { label: string; description: string; className: string }
> = {
  PENDING: {
    label: "Pending review",
    description: "Your application has been submitted and is awaiting review.",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  UNDER_REVIEW: {
    label: "Under review",
    description: "Our team is currently reviewing your application.",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  NEEDS_INFO: {
    label: "More information required",
    description: "Please review the administrator's feedback and answer the questions below.",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  APPROVED: {
    label: "Approved",
    description: "Your seller application has been approved.",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  REJECTED: {
    label: "Rejected",
    description: "Your seller application was not approved.",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

export default function SellerApplicationPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();

  const [application, setApplication] = useState<SellerApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [description, setDescription] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});

  const loadApplication = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/seller/application", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load your application.");
      }

      const currentApplication = data.application as SellerApplication | null;

      setApplication(currentApplication);

      if (currentApplication) {
        setBusinessName(currentApplication.businessName || "");
        setBusinessType(currentApplication.businessType || "");
        setDescription(currentApplication.description || "");

        const existingAnswers: Record<string, string | boolean> = {};

        if (currentApplication.submittedAnswers) {
          for (const answer of currentApplication.submittedAnswers) {
            existingAnswers[answer.questionId] = answer.value;
          }
        }

        setAnswers(existingAnswers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      loadApplication();
    } else if (sessionStatus === "unauthenticated") {
      setLoading(false);
    }
  }, [sessionStatus, loadApplication]);

  function updateAnswer(questionId: string, value: string | boolean) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  }

  async function handleResubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (businessName.trim().length < 2) {
      setError("Business name must contain at least 2 characters.");
      return;
    }

    if (businessType.trim().length < 2) {
      setError("Please enter a valid business type.");
      return;
    }

    if (description.trim().length < 10) {
      setError("Business description must contain at least 10 characters.");
      return;
    }

    const questions = application?.requestedQuestions || [];

    for (const question of questions) {
      const answer = answers[question.id];

      if (question.type === "TRUE_FALSE") {
        if (typeof answer !== "boolean") {
          setError(`Please select True or False for question: ${question.question}`);
          return;
        }
      } else if (typeof answer !== "string" || !answer.trim()) {
        setError(`Please answer: ${question.question}`);
        return;
      } else if (
        question.type === "SHORT_ANSWER" &&
        answer.trim().length > 500
      ) {
        setError(`Your answer to "${question.question}" must not exceed 500 characters.`);
        return;
      }
    }

    const submittedAnswers = questions.map((question) => ({
      questionId: question.id,
      value: answers[question.id],
    }));

    setSubmitting(true);

    try {
      const response = await fetch("/api/seller/application", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessType: businessType.trim(),
          description: description.trim(),
          answers: submittedAnswers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to resubmit your application.");
      }

      setSuccess(
        data.message || "Your updated application has been resubmitted."
      );

      await loadApplication();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-3 py-20 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your application...
        </div>
      </main>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <h1 className="text-xl font-bold text-gray-900">Sign in required</h1>
          <p className="mt-2 text-sm text-gray-500">
            Sign in to view and manage your seller application.
          </p>
          <button
            onClick={() =>
              router.push(
                `/login?callbackUrl=${encodeURIComponent("/account/seller-application")}`
              )
            }
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  const statusInfo = application
    ? statusDetails[application.status] || {
        label: application.status.replaceAll("_", " "),
        description: "Your application status has been updated.",
        className: "bg-gray-50 text-gray-700 border-gray-200",
      }
    : null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 pb-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/account"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to account
        </Link>

        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-blue-600">
            <Building2 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Seller centre
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Seller application
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your application and respond to requests from our review team.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {success}
          </div>
        )}

        {!application ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">
              No application found
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              There is no seller application associated with your account.
              If you received a seller invitation, use the application link
              provided with that invitation.
            </p>
            <Link
              href="/account"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Return to account
            </Link>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-gray-900">
                  Application status
                </h2>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo?.className}`}
                >
                  {statusInfo?.label}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {statusInfo?.description}
              </p>

              <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                <Clock3 className="h-4 w-4" />
                Submitted{" "}
                {new Date(application.createdAt).toLocaleDateString("en-GH", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </section>

            {(application.adminNotes || application.rejectionReason) && (
              <section className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-orange-600" />
                  <h2 className="font-semibold text-orange-900">
                    Administrator feedback
                  </h2>
                </div>

                {application.adminNotes && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">
                      Additional information requested
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-orange-950">
                      {application.adminNotes}
                    </p>
                  </div>
                )}

                {application.rejectionReason && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">
                      Review reason
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-orange-950">
                      {application.rejectionReason}
                    </p>
                  </div>
                )}
              </section>
            )}

            {application.status === "NEEDS_INFO" ? (
              <section className="mt-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-gray-900">
                    Update your application
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    Review your business details and answer every question from
                    the administrator before resubmitting.
                  </p>
                </div>

                <form onSubmit={handleResubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="businessName"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Business name
                    </label>
                    <input
                      id="businessName"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={120}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="businessType"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Business type
                    </label>
                    <input
                      id="businessType"
                      value={businessType}
                      onChange={(event) => setBusinessType(event.target.value)}
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="e.g. Retail, Electronics, Fashion"
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="description"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Business description
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      required
                      minLength={10}
                      maxLength={2000}
                      rows={5}
                      placeholder="Tell us about your business and the products you intend to sell."
                      className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-right text-xs text-gray-400">
                      {description.length}/2000
                    </p>
                  </div>

                  {application.requestedQuestions.length > 0 && (
                    <div className="border-t border-gray-200 pt-5">
                      <div className="mb-4 flex items-center gap-2">
                        <MessageSquareText className="h-5 w-5 text-blue-600" />
                        <h3 className="font-bold text-gray-900">
                          Administrator questions
                        </h3>
                      </div>

                      <p className="mb-5 text-sm text-gray-500">
                        Please provide an answer to each question. All questions
                        are required.
                      </p>

                      <div className="space-y-5">
                        {application.requestedQuestions.map((question, index) => (
                          <div
                            key={question.id}
                            className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                          >
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <label
                                htmlFor={`question-${question.id}`}
                                className="text-sm font-semibold text-gray-900"
                              >
                                {index + 1}. {question.question}
                              </label>
                              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                {question.type === "SHORT_ANSWER"
                                  ? "Short answer"
                                  : question.type === "LONG_ANSWER"
                                    ? "Long answer"
                                    : "True / False"}
                              </span>
                            </div>

                            {question.type === "SHORT_ANSWER" && (
                              <input
                                id={`question-${question.id}`}
                                type="text"
                                value={
                                  typeof answers[question.id] === "string"
                                    ? answers[question.id] as string
                                    : ""
                                }
                                onChange={(event) =>
                                  updateAnswer(question.id, event.target.value)
                                }
                                maxLength={500}
                                required
                                placeholder="Enter your answer"
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                            )}

                            {question.type === "LONG_ANSWER" && (
                              <textarea
                                id={`question-${question.id}`}
                                value={
                                  typeof answers[question.id] === "string"
                                    ? answers[question.id] as string
                                    : ""
                                }
                                onChange={(event) =>
                                  updateAnswer(question.id, event.target.value)
                                }
                                maxLength={5000}
                                rows={4}
                                required
                                placeholder="Write your detailed answer here..."
                                className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                            )}

                            {question.type === "TRUE_FALSE" && (
                              <div
                                id={`question-${question.id}`}
                                className="grid grid-cols-2 gap-3"
                              >
                                {[true, false].map((value) => (
                                  <button
                                    key={String(value)}
                                    type="button"
                                    aria-pressed={answers[question.id] === value}
                                    onClick={() =>
                                      updateAnswer(question.id, value)
                                    }
                                    className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                                      answers[question.id] === value
                                        ? value
                                          ? "border-green-600 bg-green-600 text-white"
                                          : "border-red-600 bg-red-600 text-white"
                                        : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                                    }`}
                                  >
                                    {value ? "True" : "False"}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Resubmitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit answers and resubmit application
                      </>
                    )}
                  </button>
                </form>
              </section>
            ) : (
              <>
                <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900">
                      Submitted business details
                    </h2>
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-400">
                        Business name
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {application.businessName}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-400">
                        Business type
                      </p>
                      <p className="mt-1 text-sm text-gray-900">
                        {application.businessType || "Not provided"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-400">
                        Description
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                        {application.description || "Not provided"}
                      </p>
                    </div>
                  </div>
                </section>

                {application.submittedAnswers &&
                  application.submittedAnswers.length > 0 && (
                    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <MessageSquareText className="h-5 w-5 text-blue-600" />
                        <h2 className="font-semibold text-gray-900">
                          Your submitted answers
                        </h2>
                      </div>

                      <div className="space-y-4">
                        {application.requestedQuestions.map((question, index) => {
                          const answer = application.submittedAnswers?.find(
                            (item) => item.questionId === question.id
                          );

                          return (
                            <div
                              key={question.id}
                              className="rounded-xl border border-gray-200 p-4"
                            >
                              <p className="text-sm font-semibold text-gray-900">
                                {index + 1}. {question.question}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                                {answer
                                  ? String(answer.value)
                                  : "No answer submitted"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
              </>
            )}
          </>
        )}

        <button
          type="button"
          onClick={loadApplication}
          disabled={loading}
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh application status
        </button>
      </div>
    </main>
  );
}