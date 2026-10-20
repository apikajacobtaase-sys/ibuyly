"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Order {
  id: string;
  totalAmount: number | string;
  status: string;
  createdAt: string;
  items: Array<{
    title: string;
    quantity: number;
    price: number | string;
  }>;
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchOrders();
    }
  }, [status, router]);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("Failed to fetch orders", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-xl">Loading your orders...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <Link href="/dashboard" className="text-indigo-600 hover:underline font-medium">
            ← Back to Dashboard
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No orders yet</h2>
            <p className="text-gray-600 mb-6">Looks like you haven&apos;t made any purchases yet.</p>
            <Link href="/concierge" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
              Talk to the AI Concierge
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              // 👇 Convert Decimal to number
              const totalAmount = typeof order.totalAmount === 'string' 
                ? parseFloat(order.totalAmount) 
                : order.totalAmount;

              return (
                <div key={order.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 pb-4 border-b">
                    <div>
                      <p className="text-sm text-gray-500">Order ID</p>
                      <p className="font-mono font-semibold text-gray-900">{order.id}</p>
                    </div>
                    <div className="mt-2 sm:mt-0 text-right">
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="font-medium text-gray-900">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="mt-2 sm:mt-0 text-right">
                      <p className="text-sm text-gray-500">Total</p>
                      <p className="font-bold text-indigo-600 text-lg">GHS {totalAmount.toFixed(2)}</p>
                    </div>
                    <div className="mt-2 sm:mt-0">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        order.status === "CONFIRMED" ? "bg-green-100 text-green-800" :
                        order.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {order.items.map((item, idx) => {
                      // 👇 Convert Decimal to number
                      const price = typeof item.price === 'string' 
                        ? parseFloat(item.price) 
                        : item.price;

                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.quantity}x {item.title}</span>
                          <span className="text-gray-900 font-medium">GHS {(price * item.quantity).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}