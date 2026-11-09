"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Store,
  FileText,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useAdminRole } from "@/hooks/usePermissions";

interface Application {
  id: string;
  businessName: string;
  businessType: string | null;
  description: string | null;
  documents: Record<string, string> | null;
  status: string;
  rejectionReason: string | null;
  adminNotes: string | null;
  userEmail: string;
  userName: string;
  hasSellerProfile: boolean;
  createdAt: string;
  reviewedAt: string | null;
  requestedQuestions: { id: string; question: string; type: "SHORT_ANSWER" | "LONG_ANSWER" | "TRUE_FALSE" }[] | null;
  submittedAnswers: { questionId: string; value: string | boolean }[] | null;
}

type QuestionType = "SHORT_ANSWER" | "LONG_ANSWER" | "TRUE_FALSE";

interface ReviewQuestion {
  id: string;
  question: string;
  type: QuestionType;
}

type ReviewAction = "APPROVE" | "REJECT" | "NEEDS_INFO";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  UNDER_REVIEW: "bg-blue-50 text-blue-700 ring-blue-200",
  NEEDS_INFO: "bg-orange-50 text-orange-700 ring-orange-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
};

const REVIEWABLE_STATUSES = ["PENDING", "UNDER_REVIEW", "NEEDS_INFO"];

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
        STATUS_STYLES[status] || "bg-gray-100 text-gray-700 ring-gray-200"
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, isSuperAdmin } = useAdminRole();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [questions, setQuestions] = useState<ReviewQuestion[]>([
    { id: crypto.randomUUID(), question: "", type: "SHORT_ANSWER" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [inAppNotificationSent, setInAppNotificationSent] = useState<boolean | null>(null);

  const fetchApplication = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/admin/applications", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load application.");
      }

      const found = (data.applications || []).find(
        (item: Application) => item.id === id
      );

      if (!found) {
        setApplication(null);
        setLoadError("This application could not be found.");
        return;
      }

      setApplication(found);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "A network error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchApplication();
  }, [fetchApplication]);

  const startReview = (selectedAction: ReviewAction) => {
    setAction(selectedAction);
    setReason("");
    setNotes("");
    setQuestions([{ id: crypto.randomUUID(), question: "", type: "SHORT_ANSWER" }]);
    setFeedback("");
    setEmailSent(null);
    setInAppNotificationSent(null);
  };

  const submitReview = async () => {
    if (!application || !action || submitting) return;

    if (action === "REJECT" && !reason.trim()) {
      setFeedback("Please provide a rejection reason.");
      return;
    }

    if (action === "NEEDS_INFO") {
      const validQuestions = questions.filter((item) => item.question.trim().length >= 3);
      if (validQuestions.length === 0) {
        setFeedback("Add at least one question before requesting information.");
        return;
      }
      if (validQuestions.length !== questions.length) {
        setFeedback("Please complete every question or remove the empty ones.");
        return;
      }
    }

    const confirmation =
      action === "APPROVE"
        ? "Approve this application and activate the seller profile?"
        : action === "REJECT"
          ? "Reject this seller application?"
          : "Request additional information from this applicant?";

    if (!window.confirm(confirmation)) return;

    setSubmitting(true);
    setFeedback("");

    try {
      const response = await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: application.id,
          action,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(action === "NEEDS_INFO" ? { questions } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Review action failed.");
      }

      setEmailSent(data.emailSent === true);
      setInAppNotificationSent(
        action === "NEEDS_INFO" ? data.inAppNotificationSent === true : null
      );
      setAction(null);
      setFeedback(data.message || "Application review completed.");

      await fetchApplication();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "A network error occurred."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-gray-500">Loading application...</p>
      </div>
    );
  }

  if (loadError || !application) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <AlertCircle className="h-7 w-7 text-rose-600" />
          <h2 className="mt-3 font-semibold text-rose-900">
            Application unavailable
          </h2>
          <p className="mt-1 text-sm text-rose-700">
            {loadError || "The requested application does not exist."}
          </p>
          <Link
            href="/admin/applications"
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to applications
          </Link>
        </div>
      </div>
    );
  }

  const canReview =
    isAdmin && REVIEWABLE_STATUSES.includes(application.status);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <Link
        href="/admin/applications"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to applications
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Seller application
          </p>
          <h1 className="mt-1 break-words text-xl font-bold text-gray-900 sm:text-2xl">
            {application.businessName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Submitted {formatDate(application.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={application.status} />
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            emailSent === false
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : feedback.includes("failed") ||
                  feedback.includes("required") ||
                  feedback.includes("concurrently")
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {feedback}

          {emailSent !== null && (
            <div className="mt-2 space-y-1 border-t border-current/10 pt-2">
              <p>
                Email notification: {emailSent ? "Delivered successfully" : "Not delivered"}
              </p>

              {inAppNotificationSent !== null && (
                <p>
                  In-app notification: {inAppNotificationSent ? "Delivered successfully" : "Not delivered"}
                </p>
              )}

              {!emailSent && inAppNotificationSent === true && (
                <p className="mt-1 font-medium">
                  The applicant can still read the instructions in their iBUY notifications.
                </p>
              )}

              {!emailSent && inAppNotificationSent === false && (
                <p className="mt-1">
                  Neither notification channel confirmed delivery. The review itself was saved.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-5 flex items-center gap-2">
              <Store className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">
                Business information
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500">Business name</p>
                <p className="mt-1 break-words font-medium text-gray-900">
                  {application.businessName}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Business type</p>
                <p className="mt-1 font-medium text-gray-900">
                  {application.businessType || "Not specified"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                  {application.description || "No description provided."}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">
                Verification documents
              </h2>
            </div>

            {application.documents &&
            Object.keys(application.documents).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(application.documents).map(([key, url]) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm transition hover:bg-gray-100"
                  >
                    <span className="min-w-0 break-all font-medium text-indigo-600">
                      {key}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      Open document
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No verification documents uploaded.
              </p>
            )}
          </section>

          {application.submittedAnswers && application.submittedAnswers.length > 0 && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
              <h2 className="font-semibold text-emerald-900">Applicant's submitted answers</h2>
              <div className="mt-3 space-y-3">
                {application.submittedAnswers.map((answer, index) => {
                  const question = application.requestedQuestions?.find((item) => item.id === answer.questionId);
                  return (
                    <div key={answer.questionId} className="rounded-lg border border-emerald-100 bg-white p-3">
                      <p className="text-xs font-semibold text-gray-500">Question {index + 1}</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">{question?.question || "Question"}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-800">
                        {typeof answer.value === "boolean" ? (answer.value ? "True" : "False") : answer.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {application.rejectionReason && (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 sm:p-5">
              <h2 className="font-semibold text-rose-900">
                Rejection reason
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-rose-800">
                {application.rejectionReason}
              </p>
            </section>
          )}

          {application.adminNotes && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
              <h2 className="font-semibold text-amber-900">
                Review notes / information requested
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-amber-800">
                {application.adminNotes}
              </p>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Applicant</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="mt-1 font-medium text-gray-900">
                  {application.userName || "Unnamed applicant"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="mt-1 flex items-start gap-2 break-all font-medium text-gray-900">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  {application.userEmail}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Seller profile</p>
                <p className="mt-1 font-medium text-gray-900">
                  {application.hasSellerProfile ? "Already exists" : "Not created"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Timeline</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Application submitted</p>
                <p className="mt-1 font-medium text-gray-800">
                  {formatDate(application.createdAt)}
                </p>
              </div>

              {application.reviewedAt && (
                <div>
                  <p className="text-xs text-gray-500">Last reviewed</p>
                  <p className="mt-1 font-medium text-gray-800">
                    {formatDate(application.reviewedAt)}
                  </p>
                </div>
              )}
            </div>
          </section>

          {canReview && (
            <section className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                <h2 className="font-semibold text-gray-900">
                  Review application
                </h2>
              </div>

              <p className="mb-4 text-xs leading-5 text-gray-500">
                {isSuperAdmin
                  ? "You can request information, approve or reject this application."
                  : "You can request additional information. Approval and rejection require SUPER_ADMIN privileges."}
              </p>

              <div className="space-y-2">
                {isSuperAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => startReview("APPROVE")}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve application
                    </button>

                    <button
                      type="button"
                      onClick={() => startReview("REJECT")}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject application
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => startReview("NEEDS_INFO")}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                >
                  <Send className="h-4 w-4" />
                  Request information
                </button>
              </div>

              {action && (
                <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {action === "APPROVE"
                      ? "Confirm approval"
                      : action === "REJECT"
                        ? "Rejection details"
                        : "Information required"}
                  </h3>

                  {action === "REJECT" && (
                    <div>
                      <label
                        htmlFor="rejection-reason"
                        className="mb-1.5 block text-xs font-medium text-gray-700"
                      >
                        Rejection reason *
                      </label>
                      <textarea
                        id="rejection-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        maxLength={1000}
                        rows={4}
                        placeholder="Explain why this application is being rejected..."
                        className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  )}

                  {action === "NEEDS_INFO" && (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="review-notes" className="mb-1.5 block text-xs font-medium text-gray-700">
                          Instructions for the applicant (optional)
                        </label>
                        <textarea
                          id="review-notes"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          maxLength={2000}
                          rows={3}
                          placeholder="Explain why this information is needed..."
                          className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-900">Applicant questions</h4>
                          <span className="text-xs text-gray-500">{questions.length}/20</span>
                        </div>

                        {questions.map((question, index) => (
                          <div key={question.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-600">Question {index + 1}</span>
                              {questions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            <textarea
                              value={question.question}
                              onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, question: event.target.value } : item))}
                              maxLength={500}
                              rows={2}
                              placeholder="Enter the question you want the applicant to answer..."
                              className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                            <label className="mt-2 block text-xs font-medium text-gray-600">Answer type</label>
                            <select
                              value={question.type}
                              onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, type: event.target.value as QuestionType } : item))}
                              className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
                            >
                              <option value="SHORT_ANSWER">Short answer</option>
                              <option value="LONG_ANSWER">Long answer</option>
                              <option value="TRUE_FALSE">True / False</option>
                            </select>
                          </div>
                        ))}

                        <button
                          type="button"
                          disabled={questions.length >= 20}
                          onClick={() => setQuestions((current) => [...current, { id: crypto.randomUUID(), question: "", type: "SHORT_ANSWER" }])}
                          className="flex min-h-10 w-full items-center justify-center rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          + Add another question
                        </button>
                      </div>
                    </div>
                  )}

                  {action === "APPROVE" && (
                    <div>
                      <label htmlFor="review-notes" className="mb-1.5 block text-xs font-medium text-gray-700">
                        Optional notes
                      </label>
                      <textarea
                        id="review-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder="Add internal review notes..."
                        className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  )}

                  {action === "REJECT" && (
                    <div>
                      <label
                        htmlFor="rejection-notes"
                        className="mb-1.5 block text-xs font-medium text-gray-700"
                      >
                        Optional internal notes
                      </label>
                      <textarea
                        id="rejection-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder="Additional internal notes..."
                        className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void submitReview()}
                      disabled={submitting}
                      className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                        action === "APPROVE"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : action === "REJECT"
                            ? "bg-rose-600 hover:bg-rose-700"
                            : "bg-amber-600 hover:bg-amber-700"
                      }`}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {submitting
                        ? "Processing..."
                        : action === "APPROVE"
                          ? "Confirm approval"
                          : action === "REJECT"
                            ? "Confirm rejection"
                            : "Send information request"}
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setAction(null);
                        setFeedback("");
                      }}
                      className="min-h-10 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {!canReview && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">
                {application.status === "APPROVED"
                  ? "Application approved"
                  : application.status === "REJECTED"
                    ? "Application rejected"
                    : "Review unavailable"}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {REVIEWABLE_STATUSES.includes(application.status)
                  ? "Your account does not have permission to perform this review action."
                  : "This application is no longer awaiting review."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
