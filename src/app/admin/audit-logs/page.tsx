// src/app/admin/audit-logs/page.tsx
"use client";

import { useEffect, useState } from "react";
import { ScrollText, Search } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: any;
  userName: string;
  userEmail?: string;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, resourceFilter]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (resourceFilter) params.set("resourceType", resourceFilter);
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = searchTerm
    ? logs.filter(
        (log) =>
          log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.resourceId?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  // Get unique actions and resource types for filters
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();
  const uniqueResources = Array.from(new Set(logs.map((l) => l.resourceType))).sort();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
        <p className="text-sm text-gray-500 mt-1">
          Track all administrative actions for compliance and security
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by user or resource..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {action.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Resources</option>
            {uniqueResources.map((resource) => (
              <option key={resource} value={resource}>
                {resource}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No audit logs found matching your criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-gray-500">
                        on {log.resourceType}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Performed by <strong>{log.userName}</strong>
                      {log.userEmail && (
                        <span className="text-gray-500"> ({log.userEmail})</span>
                      )}
                      {log.resourceId && (
                        <span className="text-gray-500">
                          {" "}• Resource: <span className="font-mono text-xs">{log.resourceId.slice(-8)}</span>
                        </span>
                      )}
                    </p>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">📋 Audit Log Information</p>
        <p>
          Showing {filteredLogs.length} of {logs.length} logs. Audit logs are immutable and cannot be deleted.
          All sensitive actions (approvals, rejections, refunds, etc.) are automatically logged.
        </p>
      </div>
    </div>
  );
}