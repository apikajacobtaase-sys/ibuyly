// src/app/account/orders/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, Calendar, ArrowRight } from "lucide-react";

export default async function MyOrdersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/orders");
  }

  const orders = await db.order.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      items: {
        include: {
          offer: {
            include: {
              seller: {
                select: {
                  businessName: true,
                },
              },
            },
          },
          variant: {
            include: {
              product: {
                select: {
                  title: true,
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`MY ORDERS: Found ${orders.length} orders.`);

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return `GH₵ ${num.toFixed(2)}`;
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-GH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-4">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
            <Package className="mx-auto mb-4 h-16 w-16 text-gray-300" />

            <h2 className="mb-2 text-lg font-semibold text-gray-900">
              No orders yet
            </h2>

            <p className="mb-6 text-gray-500">
              Looks like you haven't placed any orders yet.
            </p>

            <Link
              href="/"
              className="inline-block rounded-lg bg-green-600 px-8 py-3 font-semibold text-white hover:bg-green-700"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Order Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="font-semibold text-gray-900">
                    Order #{order.id.slice(-8).toUpperCase()}
                  </span>

                  <span className="flex items-center gap-1 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    {formatDate(order.createdAt)}
                  </span>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    order.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-800"
                      : order.status === "CONFIRMED"
                        ? "bg-blue-100 text-blue-800"
                        : order.status === "SHIPPED"
                          ? "bg-purple-100 text-purple-800"
                          : order.status === "DELIVERED"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {order.status}
                </span>
              </div>

              {/* Order Items */}
              <div className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                      {item.variant?.product?.images?.[0]?.url ? (
                        <img
                          src={item.variant.product.images[0].url}
                          alt={item.title || "Product"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                          No Img
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-medium text-gray-900">
                        {item.title ||
                          item.variant?.product?.title ||
                          "Product"}
                      </h3>

                      <p className="mt-1 text-xs text-gray-500">
                        Sold by:{" "}
                        {item.offer?.seller?.businessName ||
                          "Seller information unavailable"}
                      </p>

                      <p className="text-xs text-gray-500">
                        Qty: {item.quantity}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(
                          parseFloat(item.price.toString()) * item.quantity
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Footer */}
              <div className="space-y-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery to:</span>
                  <span className="max-w-[200px] truncate text-right">
                    {order.deliveryLocality || "Address not specified"}
                  </span>
                </div>

                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery Fee:</span>
                  <span>{formatCurrency(Number(order.deliveryFee))}</span>
                </div>

                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatCurrency(Number(order.totalAmount))}</span>
                </div>

                {/* View Order Details Button */}
                <div className="pt-3">
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    View Order Details
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
