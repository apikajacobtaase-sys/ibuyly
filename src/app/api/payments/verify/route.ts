 // src/app/api/payments/verify/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import https from "https";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const reference = body.reference;

    if (!reference) {
      return NextResponse.json({ error: "Reference is required" }, { status: 400 });
    }

    console.log(`🔍 Verifying payment for reference: ${reference}`);

    // 1. Find the Order
    const order = await db.order.findFirst({
      where: { paymentReference: reference },
      include: {
        payment: true,
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    seller: {
                      include: {
                        user: { select: { email: true, firstName: true, lastName: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (!order) {
      console.error(`❌ Order not found for reference: ${reference}`);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 2. Verify with Paystack
    const verifyResult = await verifyWithPaystack(reference);
    if (!verifyResult.success) {
      return NextResponse.json({ error: verifyResult.error }, { status: 400 });
    }

    // 3. Idempotency Check
    if (order.payment?.status === "SUCCESSFUL") {
      return NextResponse.json({ success: true, orderId: order.id, message: "Already verified" });
    }

    // 4. Update Database
    await db.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { orderId: order.id, status: "PENDING" },
        data: { status: "SUCCESSFUL", providerTransactionId: reference },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
      });

      // ✅ FIX: Safely handle items for financial records
      if (order.items && order.items.length > 0) {
        const sellerTotals = new Map<string, { grossAmount: number; commissionRate: number }>();
        
        for (const item of order.items) {
          // Safety check for nested relations to prevent "null" crashes
          const seller = item.variant?.product?.seller;
          if (!seller) {
            console.warn(`⚠️ Item ${item.id} is missing seller data. Skipping financial record.`);
            continue;
          }
          
          const sellerId = seller.id;
          const commissionRate = seller.commissionRate.toNumber();
          const lineTotal = item.price.toNumber() * item.quantity;

          if (!sellerTotals.has(sellerId)) {
            sellerTotals.set(sellerId, { grossAmount: 0, commissionRate });
          }
          const existing = sellerTotals.get(sellerId)!;
          existing.grossAmount += lineTotal;
        }

        for (const [sellerId, data] of sellerTotals.entries()) {
          const commissionAmount = (data.grossAmount * data.commissionRate) / 100;
          await tx.sellerFinancialRecord.create({
            data: {
              sellerId, 
              orderId: order.id, 
              type: "SALE", 
              amount: data.grossAmount, 
              currency: "GHS",
              description: `Order #${order.id.slice(-8).toUpperCase()} - Gross sale`,
            },
          });
          await tx.sellerFinancialRecord.create({
            data: {
              sellerId, 
              orderId: order.id, 
              type: "FEE", 
              amount: -commissionAmount, 
              currency: "GHS",
              description: `Platform commission (${data.commissionRate}%)`,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true, orderId: order.id });

  } catch (error: any) {
    console.error("💥 Verification Crash:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper function
function verifyWithPaystack(reference: string): Promise<{ success: boolean; data?: any; error?: string }> {
  return new Promise((resolve) => {
    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const request = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.status && json.data && json.data.status === "success") {
            resolve({ success: true, data: json.data });
          } else {
            resolve({ success: false, error: json.message || "Payment failed" });
          }
        } catch (e) {
          resolve({ success: false, error: "Invalid response from Paystack" });
        }
      });
    });

    request.on("error", (e) => resolve({ success: false, error: e.message }));
    request.end();
  });
}