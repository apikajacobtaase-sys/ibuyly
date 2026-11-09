"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bell,
  Package,
  Star,
  Wallet,
  AlertTriangle,
  Info,
  Check,
  CheckCheck,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export default function CustomerNotificationsPage() {
  const router = useRouter();
  const { status } = useSession();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/account/notifications");
    }

    if (status === "authenticated") {
      void fetchNotifications();
    }
  }, [status, router]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();

      if (res.ok) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string, link?: string) => {
    const notification = notifications.find((item) => item.id === id);

    try {
      if (notification && !notification.isRead) {
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: id }),
        });

        if (!response.ok) {
          throw new Error("Could not update notification.");
        }

        setNotifications((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, isRead: true } : item
          )
        );

        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      if (link) {
        router.push(link);
      }
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllAsRead: true }),
      });

      if (!response.ok) {
        throw new Error("Could not update notifications.");
      }

      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "ORDER":
        return <Package className="h-5 w-5 text-blue-600" />;
      case "REVIEW":
        return <Star className="h-5 w-5 text-yellow-600" />;
      case "PAYOUT":
        return <Wallet className="h-5 w-5 text-green-600" />;
      case "SYSTEM":
        return <Info className="h-5 w-5 text-gray-600" />;
      case "ALERT":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default:
        return <Bell className="h-5 w-5 text-green-600" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case "ORDER":
        return "bg-blue-100";
      case "REVIEW":
        return "bg-yellow-100";
      case "PAYOUT":
        return "bg-green-100";
      case "SYSTEM":
        return "bg-gray-100";
      case "ALERT":
        return "bg-orange-100";
      default:
        return "bg-green-100";
    }
  };

  const isApplicationNotification = (notification: Notification) =>
    notification.link?.includes("/account/seller-application") ?? false;

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((notification) => !notification.isRead)
      : notifications;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-white p-4 md:p-0">
      <div className="flex flex-col justify-between gap-3 pt-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Bell className="h-6 w-6" />
            Notifications
            {unreadCount > 0 && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-700">
                {unreadCount}
              </span>
            )}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Stay updated on your orders and account activity.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            filter === "all"
              ? "border-green-600 text-green-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          All ({notifications.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            filter === "unread"
              ? "border-green-600 text-green-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Bell className="mx-auto mb-3 h-12 w-12 text-gray-300" />

          <h3 className="text-lg font-medium text-gray-900">
            {filter === "unread"
              ? "No unread notifications"
              : "No notifications yet"}
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            {filter === "unread"
              ? "You're all caught up!"
              : "Notifications about your orders and account will appear here."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
          {filteredNotifications.map((notification) => {
            const applicationNotification =
              isApplicationNotification(notification);

            return (
              <div
                key={notification.id}
                className={`p-4 transition-colors hover:bg-gray-50 sm:p-5 ${
                  !notification.isRead ? "bg-green-50/30" : ""
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getIconBg(notification.type)}`}
                  >
                    {getIcon(notification.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${
                            !notification.isRead
                              ? "font-semibold text-gray-900"
                              : "font-medium text-gray-700"
                          }`}
                        >
                          {notification.title}
                        </p>

                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                          {notification.message}
                        </p>
                      </div>

                      {!notification.isRead && (
                        <button
                          type="button"
                          onClick={() => void markAsRead(notification.id)}
                          className="shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-green-100 hover:text-green-700"
                          title="Mark as read"
                          aria-label="Mark notification as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <p className="text-xs text-gray-500">
                        {new Date(notification.createdAt).toLocaleDateString(
                          "en-GH",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>

                      {notification.link && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            notification.isRead
                              ? "bg-gray-100 text-gray-600"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {applicationNotification
                            ? "Action required"
                            : "Action available"}
                        </span>
                      )}
                    </div>

                    {notification.link && (
                      <button
                        type="button"
                        onClick={() =>
                          void markAsRead(
                            notification.id,
                            notification.link
                          )
                        }
                        className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto ${
                          applicationNotification
                            ? "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                            : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                        }`}
                      >
                        {applicationNotification
                          ? "View Application"
                          : "View Details"}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}