// src/app/admin/sellers/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Store, FileText, Clock } from "lucide-react";
import { StatusBadge } from "@/components/dashboard";

export default function AdminSellerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [application, setApplication] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchApplication();
  }, [params.id]);

  const fetchApplication = async () => {
    try {
      const res = await fetch("/api/admin/applications");
      const data = await res.json();
      if (res.ok) {
        const found = data.applications.find((a: any) => a.id === params.id);
        if (found) {
          setApplication(found);
        } else {
          router.push("/admin/sellers");
        }
      }
    } catch (error) {
      console.error("Failed to fetch application", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!application) return null;

  return (
    <div className="space-y-6">
      <Link href="/admin/sellers" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Applications
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{application.businessName}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Applied on {new Date(application.createdAt).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={application.status} size="md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Application Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Business Information</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Business Name</p>
                <p className="font-medium text-gray-900">{application.businessName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Business Type</p>
                <p className="font-medium text-gray-900">{application.businessType || "Not specified"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {application.description || "No description provided"}
                </p>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Verification Documents</h3>
            </div>
            {application.documents && Object.keys(application.documents).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(application.documents).map(([key, url]) => (
                  <a
                    key={key}
                    href={url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-sm text-indigo-600 hover:underline"
                  >
                    📎 {key}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No documents uploaded</p>
            )}
          </div>

          {/* Rejection Reason (if applicable) */}
          {application.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h3 className="font-semibold text-red-900 mb-2">Rejection Reason</h3>
              <p className="text-sm text-red-800 whitespace-pre-wrap">{application.rejectionReason}</p>
            </div>
          )}

          {/* Admin Notes */}
          {application.adminNotes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <h3 className="font-semibold text-yellow-900 mb-2">Admin Notes</h3>
              <p className="text-sm text-yellow-800 whitespace-pre-wrap">{application.adminNotes}</p>
            </div>
          )}
        </div>

        {/* Right: Applicant Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Applicant</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="font-medium text-gray-900">{application.userName || "Unnamed"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <p className="font-medium text-gray-900 break-all">{application.userEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Has Seller Profile</p>
                <p className="font-medium text-gray-900">
                  {application.hasSellerProfile ? "✓ Yes" : "✗ No"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Timeline</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">Applied</p>
                <p className="font-medium text-gray-900">
                  {new Date(application.createdAt).toLocaleString()}
                </p>
              </div>
              {application.reviewedAt && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Reviewed</p>
                  <p className="font-medium text-gray-900">
                    {new Date(application.reviewedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}