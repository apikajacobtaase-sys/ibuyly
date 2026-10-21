// src/app/account/orders/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Package, Calendar } from "lucide-react";

export default async function MyOrdersPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/orders");
  }

  console.log("🔍 MY ORDERS DEBUG: Fetching orders for userId:", session.user.id);

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
  console.log(`✅ MY ORDERS DEBUG: Found ${orders.length} orders for this user.`);

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `GH₵ ${num.toFixed(2)}`;
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString("en-GH", { 
    year: "numeric", month: "long", day: "numeric" 
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-8">
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-20">
        <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {orders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed border-gray-300">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No orders yet</h2>
            <p className="text-gray-500 mb-6">Looks like you haven't placed any orders yet.</p>
            <Link href="/" className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors">
              Start Shopping
            </Link>
  
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              {/* Order Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-semibold text-gray-900">Order #{order.id.slice(-8).toUpperCase()}</span>
                  <span className="flex items-center gap-1 text-gray-600">
                    <Calendar className="w-4 h-4" /> {formatDate(order.createdAt)}
                  </span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  order.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                  order.status === "CONFIRMED" ? "bg-blue-100 text-blue-800" :
                  order.status === "SHIPPED" ? "bg-purple-100 text-purple-800" :
                  order.status === "DELIVERED" ? "bg-green-100 text-green-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {order.status}
                </span>
              </div>

              {/* Order Items */}
              <div className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <div key={item.id} className="p-4 flex gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                      {item.variant?.product?.images?.[0]?.url ? (
                        <img src={item.variant.product.images[0].url} alt={item.title || "Product"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Img</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{item.title || item.variant?.product?.title || "Product"}</h3>
                      {/* 👇 Get seller name from variant.product.seller */}
                      <p className="text-xs text-gray-500 mt-1">
                       Sold by: {item.offer?.seller?.businessName || "Seller information unavailable"}
                      </p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(parseFloat(item.price.toString()) * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Footer / Totals */}
              <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery to:</span>
                  <span className="text-right max-w-[200px] truncate">
                    {order.deliveryLocality || "Address not specified"}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery Fee:</span>
                  <span>{formatCurrency(order.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total</span>
                  <span>{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}