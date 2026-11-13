 import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

type ConfirmPaymentInput = {
  reference: string;
  verifiedVia: "verify" | "webhook";
  paystackResponse: Prisma.InputJsonValue;
};

type SellerItem = {
  id: string;
  grossCents: number;
  discountCents: number;
  netCents: number;
  commissionCents: number;
};

type SellerTotal = {
  commissionRate: number;
  items: SellerItem[];
  grossCents: number;
  discountCents: number;
  netCents: number;
};

function toCents(value: Prisma.Decimal): number {
  const amount = value.toNumber();

  if (!Number.isFinite(amount)) {
    throw new Error("Invalid monetary value.");
  }

  const cents = Math.round(amount * 100);

  if (Math.abs(amount * 100 - cents) > 1e-7) {
    throw new Error("Monetary value exceeds two decimal places.");
  }

  return cents;
}

function allocateCents(
  items: { id: string; amountCents: number }[],
  totalCents: number
): Map<string, number> {
  const allocations = new Map<string, number>();

  if (totalCents === 0 || items.length === 0) {
    return allocations;
  }

  const denominator = items.reduce(
    (sum, item) => sum + item.amountCents,
    0
  );

  if (
    !Number.isSafeInteger(denominator) ||
    denominator <= 0 ||
    totalCents < 0 ||
    totalCents > denominator
  ) {
    throw new Error("Invalid proportional allocation.");
  }

  const shares = items.map((item) => {
    const numerator =
      BigInt(totalCents) * BigInt(item.amountCents);

    return {
      id: item.id,
      amount: Number(numerator / BigInt(denominator)),
      remainder: numerator % BigInt(denominator),
    };
  });

  const allocated = shares.reduce(
    (sum, share) => sum + share.amount,
    0
  );

  const remaining = totalCents - allocated;

  shares.sort((a, b) => {
    if (a.remainder > b.remainder) return -1;
    if (a.remainder < b.remainder) return 1;
    return a.id.localeCompare(b.id);
  });

  shares.forEach((share, index) => {
    allocations.set(
      share.id,
      share.amount + (index < remaining ? 1 : 0)
    );
  });

  return allocations;
}

export async function confirmSuccessfulPayment({
  reference,
  verifiedVia,
  paystackResponse,
}: ConfirmPaymentInput): Promise<{ claimed: boolean; orderId: string }> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: {
        paymentReference: reference,
      },
      include: {
        payment: true,
        discountCode: true,
        items: {
          include: {
            offer: {
              include: {
                seller: true,
              },
            },
          },
        },
      },
    });

    if (!order || !order.payment) {
      throw new Error(`Order or payment not found for ${reference}.`);
    }

    if (order.payment.status === "SUCCESSFUL") {
      return {
        claimed: false,
        orderId: order.id,
      };
    }

    if (
      order.payment.status !== "PENDING" ||
      order.status !== "PENDING"
    ) {
      throw new Error(
        `Order ${order.id} or its payment is no longer pending.`
      );
    }

    if (order.payment.provider !== "PAYSTACK") {
      throw new Error("Payment provider is not Paystack.");
    }

    if (order.items.length === 0) {
      throw new Error(`Order ${order.id} has no items.`);
    }

    const sellerTotals = new Map<string, SellerTotal>();
    let totalDiscountCents = 0;

    for (const item of order.items) {
      if (
        !item.sellerId ||
        !item.offerId ||
        !item.offer ||
        item.offer.id !== item.offerId ||
        item.offer.sellerId !== item.sellerId ||
        item.offer.seller.id !== item.sellerId ||
        item.offer.variantId !== item.variantId
      ) {
        throw new Error(
          `Seller ownership validation failed for item ${item.id}.`
        );
      }

      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(`Invalid quantity for item ${item.id}.`);
      }

      const unitPriceCents = toCents(item.price);
      const grossCents = unitPriceCents * item.quantity;
      const discountCents = toCents(item.discountAmount);

      if (
        !Number.isSafeInteger(grossCents) ||
        grossCents <= 0 ||
        discountCents < 0 ||
        discountCents > grossCents
      ) {
        throw new Error(
          `Invalid monetary allocation for item ${item.id}.`
        );
      }

      if (
        discountCents > 0 &&
        (!order.discountCode ||
          order.discountCode.sellerId !== item.sellerId)
      ) {
        throw new Error(
          `Discount ownership validation failed for item ${item.id}.`
        );
      }

      totalDiscountCents += discountCents;

      if (!Number.isSafeInteger(totalDiscountCents)) {
        throw new Error("Invalid aggregated discount amount.");
      }

      const netCents = grossCents - discountCents;
      const commissionRate =
        item.offer.seller.commissionRate.toNumber();

      if (
        !Number.isFinite(commissionRate) ||
        commissionRate < 0 ||
        commissionRate > 100
      ) {
        throw new Error(
          `Invalid commission rate for seller ${item.sellerId}.`
        );
      }

      let seller = sellerTotals.get(item.sellerId);

      if (!seller) {
        seller = {
          commissionRate,
          items: [],
          grossCents: 0,
          discountCents: 0,
          netCents: 0,
        };

        sellerTotals.set(item.sellerId, seller);
      } else if (seller.commissionRate !== commissionRate) {
        throw new Error(
          `Inconsistent commission rate for seller ${item.sellerId}.`
        );
      }

      seller.grossCents += grossCents;
      seller.discountCents += discountCents;
      seller.netCents += netCents;

      seller.items.push({
        id: item.id,
        grossCents,
        discountCents,
        netCents,
        commissionCents: 0,
      });
    }

    if (totalDiscountCents !== toCents(order.discountAmount)) {
      throw new Error(
        `Order ${order.id} discount allocation does not reconcile.`
      );
    }

    if (
      totalDiscountCents > 0 &&
      !order.discountCode
    ) {
      throw new Error(
        `Order ${order.id} has a discount without a discount code.`
      );
    }

    // Calculate commission on discounted merchandise.
    for (const [sellerId, seller] of sellerTotals) {
      const commissionCents = Math.round(
        (seller.netCents * seller.commissionRate) / 100
      );

      if (
        !Number.isSafeInteger(commissionCents) ||
        commissionCents < 0 ||
        commissionCents > seller.netCents
      ) {
        throw new Error(
          `Invalid commission for seller ${sellerId}.`
        );
      }

      const allocations = allocateCents(
        seller.items.map((item) => ({
          id: item.id,
          amountCents: item.netCents,
        })),
        commissionCents
      );

      for (const item of seller.items) {
        item.commissionCents = allocations.get(item.id) ?? 0;
      }

      const allocatedCommission = seller.items.reduce(
        (sum, item) => sum + item.commissionCents,
        0
      );

      if (allocatedCommission !== commissionCents) {
        throw new Error(
          `Commission allocation failed for seller ${sellerId}.`
        );
      }
    }

    // Atomically claim the payment.
    const claim = await tx.payment.updateMany({
      where: {
        orderId: order.id,
        status: "PENDING",
      },
      data: {
        status: "SUCCESSFUL",
        providerTransactionId: reference,
        metadata: {
          paystackResponse,
          verifiedAt: new Date().toISOString(),
          verifiedVia,
        },
      },
    });

    if (claim.count !== 1) {
      return {
        claimed: false,
        orderId: order.id,
      };
    }

    const orderUpdate = await tx.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
      },
      data: {
        status: "CONFIRMED",
      },
    });

    if (orderUpdate.count !== 1) {
      throw new Error(
        `Could not confirm order ${order.id}.`
      );
    }

    // Persist item-level commission snapshots.
    for (const seller of sellerTotals.values()) {
      for (const item of seller.items) {
        await tx.orderItem.update({
          where: {
            id: item.id,
          },
          data: {
            commissionAmount: item.commissionCents / 100,
          },
        });
      }
    }

    // Create seller financial records.
    for (const [sellerId, seller] of sellerTotals) {
      const orderLabel = `Order #${order.id
        .slice(-8)
        .toUpperCase()}`;

      await tx.sellerFinancialRecord.create({
        data: {
          sellerId,
          orderId: order.id,
          type: "SALE",
          amount: seller.grossCents / 100,
          currency: order.payment.currency,
          description: `${orderLabel} - Gross sale`,
        },
      });

      if (seller.discountCents > 0) {
        await tx.sellerFinancialRecord.create({
          data: {
            sellerId,
            orderId: order.id,
            type: "DISCOUNT",
            amount: -seller.discountCents / 100,
            currency: order.payment.currency,
            description: `${orderLabel} - Seller-funded discount`,
          },
        });
      }

      const commissionCents = seller.items.reduce(
        (sum, item) => sum + item.commissionCents,
        0
      );

      if (commissionCents > 0) {
        await tx.sellerFinancialRecord.create({
          data: {
            sellerId,
            orderId: order.id,
            type: "FEE",
            amount: -commissionCents / 100,
            currency: order.payment.currency,
            description: `Platform commission (${seller.commissionRate}%)`,
          },
        });
      }
    }

    return {
      claimed: true,
      orderId: order.id,
    };
  });
}