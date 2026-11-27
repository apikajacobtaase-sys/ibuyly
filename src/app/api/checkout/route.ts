 import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

class CheckoutError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CheckoutError";
    this.status = status;
  }
}

const checkoutSchema = z
  .object({
    cartItemIds: z
      .array(z.string().min(1))
      .min(1, "Select at least one item.")
      .max(50, "Too many items were selected.")
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Duplicate cart items are not allowed."
      ),
    localityId: z.string().min(1, "Delivery locality is required."),
    discountCode: z.string().trim().min(1).max(80).optional(),
    paymentMethod: z.enum(["PAYSTACK", "COD"]).default("PAYSTACK"),
    address: z
      .object({
        recipientName: z.string().trim().min(1).max(150),
        phone: z.string().trim().min(1).max(40),
        country: z.string().trim().min(1).max(80).optional().default("Ghana"),
        landmark: z.string().trim().max(300).optional(),
        street: z.string().trim().min(1).max(500),
        instructions: z.string().trim().max(1000).optional(),

      })
      .strict(),
  })
  .strict();

function toCents(value: unknown): number {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new CheckoutError(
      "An invalid price was found. Please refresh your cart.",
      400
    );
  }

  return Math.round(amount * 100);
}

function centsToAmount(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function allocateDiscountCents(
  items: { id: string; amountCents: number }[],
  discountCents: number
): Map<string, number> {
  const allocations = new Map<string, number>();

  if (discountCents <= 0 || items.length === 0) {
    return allocations;
  }

  const totalCents = items.reduce(
    (sum, item) => sum + item.amountCents,
    0
  );

  if (
    !Number.isSafeInteger(totalCents) ||
    discountCents > totalCents
  ) {
    throw new CheckoutError("Invalid discount allocation.");
  }

  const total = BigInt(totalCents);
  const discount = BigInt(discountCents);

  const shares = items.map((item) => {
    const numerator = discount * BigInt(item.amountCents);

    return {
      id: item.id,
      amount: Number(numerator / total),
      remainder: numerator % total,
    };
  });

  const allocated = shares.reduce(
    (sum, share) => sum + share.amount,
    0
  );

  const remaining = discountCents - allocated;

  shares
    .sort((a, b) => {
      if (a.remainder > b.remainder) return -1;
      if (a.remainder < b.remainder) return 1;
      return a.id.localeCompare(b.id);
    })
    .forEach((share, index) => {
      allocations.set(
        share.id,
        share.amount + (index < remaining ? 1 : 0)
      );
    });

  return allocations;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);



if (!session?.user?.id) {
  return NextResponse.json(
    { error: "Please sign in before checking out." },
    { status: 401 }
  );
}

    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const parsed = checkoutSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Invalid checkout details.",
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const paymentMethod = input.paymentMethod;

const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
const appUrl = process.env.NEXTAUTH_URL;

if (paymentMethod === "PAYSTACK") {
  if (!session.user.email) {
    throw new CheckoutError(
      "Your account needs a valid email address to make a payment.",
      400
    );
  }

  if (!paystackSecret || !appUrl) {
    throw new CheckoutError(
      "Online payment is temporarily unavailable.",
      503
    );
  }
}
    const userId = session.user.id;
    const now = new Date();

    // 1. Load only the signed-in user's submitted cart items.
    const cartItems = await db.cartItem.findMany({
      where: {
        id: { in: input.cartItemIds },
        cart: { userId },
      },
      include: {
        offer: {
          include: {
            flashDeals: {
              where: {
                isActive: true,
                startsAt: { lte: now },
                endsAt: { gt: now },
              },
              orderBy: { endsAt: "asc" },
              take: 1,
            },
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                  },
                },
              },
            },
            seller: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (cartItems.length !== input.cartItemIds.length) {
      throw new CheckoutError(
        "Your cart has changed. Refresh your cart and try again.",
        400
      );
    }

    // 2. Validate products, offers and quantities.
    for (const item of cartItems) {
      const offer = item.offer;

      if (!offer || offer.status !== "ACTIVE") {
        throw new CheckoutError(
          "One or more items are no longer available. Refresh your cart.",
          400
        );
      }

      if (
        !offer.variant ||
        !offer.variant.isActive ||
        offer.variant.product.status !== "ACTIVE"
      ) {
        throw new CheckoutError(
          "One or more products are no longer available. Refresh your cart.",
          400
        );
      }

      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        throw new CheckoutError(
          "An invalid item quantity was found in your cart.",
          400
        );
      }

      if (toCents(offer.price) <= 0) {
        throw new CheckoutError(
          "One or more items have an invalid price. Please contact support.",
          400
        );
      }
    }

    // 3. Validate flash deals and calculate authoritative prices.
    const itemPricing = new Map<
      string,
      { priceCents: number; flashDealId: string | null }
    >();

    for (const item of cartItems) {
      const offer = item.offer!;
      const deal = offer.flashDeals[0];

      if (!deal) {
        itemPricing.set(item.id, {
          priceCents: toCents(offer.price),
          flashDealId: null,
        });

        continue;
      }

      const remainingQuantity =
        deal.dealQuantity -
        deal.soldQuantity -
        deal.reservedQuantity;

      const promotionalPriceCents = toCents(deal.promotionalPrice);
      const regularPriceCents = toCents(offer.price);

      if (
        remainingQuantity < item.quantity ||
        promotionalPriceCents <= 0 ||
        promotionalPriceCents >= regularPriceCents
      ) {
        throw new CheckoutError(
          `"${offer.variant.product.title}" no longer has enough flash-deal stock. Refresh your cart.`,
          409
        );
      }

      itemPricing.set(item.id, {
        priceCents: promotionalPriceCents,
        flashDealId: deal.id,
      });
    }

    // 4. Validate the selected delivery locality and active zone.
    const zoneLocality = await db.deliveryZoneLocality.findFirst({
      where: {
  localityId: input.localityId,
  locality: {
    isActive: true,
    district: {
      isActive: true,
      region: {
        isActive: true,
      },
    },
  },
  deliveryZone: { status: "ACTIVE" },
},
      include: {
        deliveryZone: true,
        locality: {
          include: {
            district: {
              include: { region: true },
            },
          },
        },
      },
    });

    if (!zoneLocality) {
      throw new CheckoutError(
        "Delivery is unavailable at the selected location.",
        400
      );
    }
  const zone = zoneLocality.deliveryZone;

if (paymentMethod === "COD" && !zone.codEnabled) {
  throw new CheckoutError(
    "Cash on Delivery is unavailable at this location.",
    400
  );
}

if (paymentMethod === "PAYSTACK" && !zone.onlinePayEnabled) {
  throw new CheckoutError(
    "Online payment is unavailable at this location.",
    400
  );
}
    const deliveryFeeCents = toCents(
      zoneLocality.deliveryZone.baseDeliveryFee
    );

    // 5. Calculate merchandise totals using authoritative prices.
    let subtotalCents = 0;

    for (const item of cartItems) {
      const pricing = itemPricing.get(item.id);

      if (!pricing) {
        throw new CheckoutError("Could not calculate item pricing.");
      }

      const itemTotal = pricing.priceCents * item.quantity;

      if (!Number.isSafeInteger(itemTotal)) {
        throw new CheckoutError("The order total is too large.", 400);
      }

      subtotalCents += itemTotal;
    }

    if (!Number.isSafeInteger(subtotalCents)) {
      throw new CheckoutError("The order total is too large.", 400);
    }
        // Enforce the delivery zone's minimum merchandise order value.
    const minOrderValue = zoneLocality.deliveryZone.minOrderValue;

    if (
      minOrderValue !== null &&
      subtotalCents < toCents(minOrderValue)
    ) {
      throw new CheckoutError(
        `Your order must be at least GH₵ ${Number(minOrderValue).toFixed(2)} to qualify for delivery to this location.`,
        400
      );
    }

    // 6. Revalidate the discount on the server.
    let discount: {
      id: string;
      sellerId: string;
      type: "PERCENTAGE" | "FIXED_AMOUNT";
      value: number;
      minOrderAmount: number | null;
      maxDiscount: number | null;
      usageLimit: number | null;
      usedCount: number;
    } | null = null;

    let discountCents = 0;

    if (input.discountCode) {
      if (
        cartItems.some(
          (item) => itemPricing.get(item.id)?.flashDealId
        )
      ) {
        throw new CheckoutError(
          "Discount codes cannot currently be combined with flash deals."
        );
      }

      const discountRecord = await db.discountCode.findUnique({
        where: {
          code: input.discountCode.toUpperCase(),
        },
      });

      if (!discountRecord || !discountRecord.isActive) {
        throw new CheckoutError(
          "This discount code is invalid or inactive."
        );
      }

      if (discountRecord.startsAt > now) {
        throw new CheckoutError(
          "This discount code is not active yet."
        );
      }

      if (discountRecord.expiresAt && discountRecord.expiresAt <= now) {
        throw new CheckoutError("This discount code has expired.");
      }

      if (
        discountRecord.usageLimit !== null &&
        discountRecord.usedCount >= discountRecord.usageLimit
      ) {
        throw new CheckoutError(
          "This discount code has reached its usage limit."
        );
      }

      const eligibleItems = cartItems.filter(
        (item) => item.offer!.sellerId === discountRecord.sellerId
      );

      if (eligibleItems.length === 0) {
        throw new CheckoutError(
          "This discount code does not apply to the items in your cart."
        );
      }

      const eligibleSubtotalCents = eligibleItems.reduce(
        (total, item) =>
          total + toCents(item.offer!.price) * item.quantity,
        0
      );

      if (
        discountRecord.minOrderAmount !== null &&
        eligibleSubtotalCents < toCents(discountRecord.minOrderAmount)
      ) {
        throw new CheckoutError(
          "Your eligible items do not meet the minimum order amount for this code."
        );
      }

      const discountValue = Number(discountRecord.value);

      if (!Number.isFinite(discountValue) || discountValue < 0) {
        throw new CheckoutError(
          "This discount code is incorrectly configured. Please contact support.",
          400
        );
      }

      if (discountRecord.type === "PERCENTAGE") {
        if (discountValue > 100) {
          throw new CheckoutError(
            "This discount code is incorrectly configured. Please contact support.",
            400
          );
        }

        discountCents = Math.round(
          (eligibleSubtotalCents * discountValue) / 100
        );
      } else {
        discountCents = Math.min(
          eligibleSubtotalCents,
          toCents(discountRecord.value)
        );
      }

      if (discountRecord.maxDiscount !== null) {
        discountCents = Math.min(
          discountCents,
          toCents(discountRecord.maxDiscount)
        );
      }

      discountCents = Math.min(
        discountCents,
        eligibleSubtotalCents
      );

      discount = {
        id: discountRecord.id,
        sellerId: discountRecord.sellerId,
        type: discountRecord.type,
        value: discountValue,
        minOrderAmount:
          discountRecord.minOrderAmount === null
            ? null
            : Number(discountRecord.minOrderAmount),
        maxDiscount:
          discountRecord.maxDiscount === null
            ? null
            : Number(discountRecord.maxDiscount),
        usageLimit: discountRecord.usageLimit,
        usedCount: discountRecord.usedCount,
      };
    }

    // 7. Allocate discounts proportionally to eligible items.
    const itemDiscountCents = new Map<string, number>();

    if (discount && discountCents > 0) {
      const eligibleItems = cartItems
        .filter((item) => item.offer!.sellerId === discount!.sellerId)
        .map((item) => ({
          id: item.id,
          amountCents: toCents(item.offer!.price) * item.quantity,
        }));

      const allocations = allocateDiscountCents(
        eligibleItems,
        discountCents
      );

      for (const [itemId, amount] of allocations) {
        itemDiscountCents.set(itemId, amount);
      }
    }

    const finalTotalCents =
      subtotalCents + deliveryFeeCents - discountCents;

    if (
      !Number.isSafeInteger(finalTotalCents) ||
      finalTotalCents <= 0
    ) {
      throw new CheckoutError(
        "The final order total must be greater than zero."
      );
    }

    const finalTotal = centsToAmount(finalTotalCents);
    const discountAmount = centsToAmount(discountCents);
    const deliveryFee = centsToAmount(deliveryFeeCents);

    // 8. Reserve seller stock and flash-deal stock, then create the order.
    const order = await db.$transaction(
      async (tx) => {
        for (const item of cartItems) {
          const offer = item.offer!;

          // Reserve normal seller inventory.
          const stockUpdate = await tx.sellerOffer.updateMany({
            where: {
              id: offer.id,
              status: "ACTIVE",
              stockQuantity: { gte: item.quantity },
            },
            data: {
              stockQuantity: { decrement: item.quantity },
            },
          });

          if (stockUpdate.count !== 1) {
            throw new CheckoutError(
              `There is insufficient stock for "${offer.variant.product.title}". Refresh your cart.`,
              409
            );
          }

          // Reserve flash-deal inventory atomically.
          const pricing = itemPricing.get(item.id)!;

          if (pricing.flashDealId) {
            const dealReservation = await tx.$executeRaw`
              UPDATE flash_deals
              SET reserved_quantity = reserved_quantity + ${item.quantity}
              WHERE id = ${pricing.flashDealId}
                AND is_active = true
                AND starts_at <= ${now}
                AND ends_at > ${now}
                AND deal_quantity - sold_quantity - reserved_quantity >= ${item.quantity}
            `;

            if (dealReservation !== 1) {
              throw new CheckoutError(
                `The flash deal for "${offer.variant.product.title}" is no longer available. Refresh your cart.`,
                409
              );
            }
          }
        }

        // Atomically claim one use of the discount code.
        if (discount) {
          const usageWhere = {
            id: discount.id,
            isActive: true,
            startsAt: { lte: now },
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
            ],
            ...(discount.usageLimit !== null
              ? { usedCount: { lt: discount.usageLimit } }
              : {}),
          };

          const usageUpdate = await tx.discountCode.updateMany({
            where: usageWhere,
            data: {
              usedCount: { increment: 1 },
            },
          });

          if (usageUpdate.count !== 1) {
            throw new CheckoutError(
              "This discount code is no longer available. Please try again.",
              409
            );
          }
        }

        return tx.order.create({
          data: {
            userId,
            totalAmount: finalTotal,
            status: "PENDING",
            discountCodeId: discount?.id ?? null,
            discountAmount,
            deliveryRecipient: input.address.recipientName,
            deliveryPhone: input.address.phone,
            deliveryFee,
            deliveryRegion: zoneLocality.locality.district.region.name,
            deliveryDistrict: zoneLocality.locality.district.name,
            deliveryLocality: zoneLocality.locality.name,
            deliveryLandmark: input.address.landmark || null,
            deliveryStreet: input.address.street,

            payment: {
              create: {
              provider:
  paymentMethod === "COD"
    ? "CASH_ON_DELIVERY"
    : "PAYSTACK",
paymentMethod,
status: "PENDING",
amount: finalTotal,
currency: "GHS",
              },
            },

            items: {
              create: cartItems.map((item) => {
                const offer = item.offer!;
                const pricing = itemPricing.get(item.id)!;

                return {
                  variant: { connect: { id: offer.variantId } },
                  title: offer.variant.product.title,
                  price: centsToAmount(pricing.priceCents),
                  quantity: item.quantity,
                  discountAmount: centsToAmount(
                    itemDiscountCents.get(item.id) ?? 0
                  ),
                  sellerId: offer.sellerId,
                  offer: { connect: { id: offer.id } },
                  ...(pricing.flashDealId
  ? { flashDeal: { connect: { id: pricing.flashDealId } } }
  : {}),
                  status: "PENDING",
                };
              }),
            },
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );
    // Complete COD checkout without initializing Paystack.
if (paymentMethod === "COD") {
  await db.cartItem.deleteMany({
    where: {
      id: { in: input.cartItemIds },
      cart: { userId },
    },
  });

  return NextResponse.json({
    success: true,
    orderId: order.id,
    paymentMethod: "COD",
    subtotal: centsToAmount(subtotalCents),
    deliveryFee,
    discountAmount,
    total: finalTotal,
  });
}
    const localReference = `ORD-${order.id}`;

    // 9. Persist the expected Paystack reference before initialization.
    try {
      await db.order.update({
        where: { id: order.id },
        data: { paymentReference: localReference },
      });
    } catch (referenceError) {
      console.error(
        "Could not persist the Paystack reference before initialization:",
        getErrorMessage(referenceError)
      );

      return NextResponse.json(
        {
          error:
            "We could not prepare your payment securely. Please contact support before trying again.",
          orderId: order.id,
        },
        { status: 503 }
      );
    }

    let paystackResponse: Response;

    // 10. Initialize payment.
    try {
      paystackResponse = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: session.user.email,
            amount: finalTotalCents,
            reference: localReference,
            callback_url: `${appUrl!.replace(/\/+$/, "")}/payment/success`,
            channels: ["card", "mobile_money", "apple_pay"],
            metadata: {
              custom_fields: [
                {
                  display_name: "Order ID",
                  variable_name: "order_id",
                  value: order.id,
                },
              ],
            },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );
    } catch (error) {
      console.error(
        "Paystack initialization outcome is uncertain:",
        getErrorMessage(error)
      );

      return NextResponse.json(
        {
          error:
            "We could not confirm payment initialization. Your order may still be pending. Please contact support before retrying.",
          orderId: order.id,
        },
        { status: 502 }
      );
    }

    let paystackData: {
      status?: boolean;
      message?: string;
      data?: {
        reference?: string;
        authorization_url?: string;
      };
    };

    try {
      paystackData = await paystackResponse.json();
    } catch {
      console.error(
        "Paystack returned an unreadable initialization response."
      );

      return NextResponse.json(
        {
          error:
            "We could not confirm payment initialization. Your order may still be pending. Please contact support before retrying.",
          orderId: order.id,
        },
        { status: 502 }
      );
    }

    // Do not release reservations for uncertain server-side failures.
    if (paystackResponse.status >= 500) {
      console.error("Paystack initialization returned a server error.");

      return NextResponse.json(
        {
          error:
            "Payment initialization is temporarily unavailable. Your order may still be pending. Please contact support before retrying.",
          orderId: order.id,
        },
        { status: 502 }
      );
    }

    // 11. Handle definitive Paystack rejection.
    if (
      !paystackResponse.ok ||
      paystackData.status !== true ||
      !paystackData.data?.reference ||
      paystackData.data.reference !== localReference ||
      !paystackData.data?.authorization_url
    ) {
      try {
        await db.$transaction(async (tx) => {
          const cancelled = await tx.order.updateMany({
            where: {
              id: order.id,
              status: "PENDING",
            },
            data: {
              status: "CANCELLED",
            },
          });

          // Compensate only if this request successfully cancelled
          // the pending order.
          if (cancelled.count === 1) {
            await tx.payment.updateMany({
              where: {
                orderId: order.id,
                status: "PENDING",
              },
              data: {
                status: "FAILED",
                metadata: {
                  reason:
                    "Paystack rejected transaction initialization.",
                },
              },
            });

            for (const item of cartItems) {
              await tx.sellerOffer.updateMany({
                where: { id: item.offer!.id },
                data: {
                  stockQuantity: { increment: item.quantity },
                },
              });

              // Release the flash-deal reservation.
              const dealId = itemPricing.get(item.id)?.flashDealId;

              if (dealId) {
                const released = await tx.flashDeal.updateMany({
                  where: {
                    id: dealId,
                    reservedQuantity: { gte: item.quantity },
                  },
                  data: {
                    reservedQuantity: {
                      decrement: item.quantity,
                    },
                  },
                });

                if (released.count !== 1) {
                  throw new Error(
                    `Could not release flash-deal reservation ${dealId}.`
                  );
                }
              }
            }

            if (discount) {
              await tx.discountCode.updateMany({
                where: {
                  id: discount.id,
                  usedCount: { gt: 0 },
                },
                data: {
                  usedCount: { decrement: 1 },
                },
              });
            }
          }
        });
      } catch (compensationError) {
        console.error(
          "Checkout compensation failed; manual reconciliation may be required:",
          getErrorMessage(compensationError)
        );
      }

      console.error(
        "Paystack rejected checkout initialization:",
        paystackData.message ?? `HTTP ${paystackResponse.status}`
      );

      return NextResponse.json(
        {
          error:
            "We could not start your payment. Your cart has been retained where possible. Please try again or contact support.",
        },
        { status: 502 }
      );
    }

    const paystackReference = paystackData.data.reference;

    // 12. Save payment reference and remove submitted cart items.
    try {
      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentReference: paystackReference },
        });

        await tx.cartItem.deleteMany({
          where: {
            id: { in: input.cartItemIds },
            cart: { userId },
          },
        });
      });
    } catch (saveError) {
      console.error(
        "Paystack initialized, but checkout finalization failed:",
        getErrorMessage(saveError)
      );

      return NextResponse.json(
        {
          error:
            "Your payment session was created, but we could not finish updating your order. Please contact support before trying again.",
          orderId: order.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      authorizationUrl: paystackData.data.authorization_url,
      reference: paystackReference,
      subtotal: centsToAmount(subtotalCents),
      deliveryFee,
      discountAmount,
      total: finalTotal,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            error.issues[0]?.message ?? "Invalid checkout details.",
        },
        { status: 400 }
      );
    }

    if (error instanceof CheckoutError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Checkout error:", getErrorMessage(error));

    return NextResponse.json(
      { error: "Checkout failed. Please try again later." },
      { status: 500 }
    );
  }
}