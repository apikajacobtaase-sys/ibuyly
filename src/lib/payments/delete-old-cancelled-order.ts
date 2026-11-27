 import { db } from "@/lib/db";

export async function deleteOldCancelledOrder(
  orderId: string,
  retentionCutoff: Date
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (
      !order ||
      order.status !== "CANCELLED" ||
      order.updatedAt > retentionCutoff ||
      !order.payment ||
      order.payment.status !== "FAILED" ||
      order.payment.provider !== "PAYSTACK" ||
      order.payment.providerTransactionId !== null
    ) {
      return false;
    }

    const [
      refunds,
      returns,
      disputes,
      shipments,
      financialRecords,
      reviews,
      sellerReviews,
      refundItems,
      orderAuditLogs,
    ] = await Promise.all([
      tx.refundOperation.count({ where: { orderId } }),
      tx.return.count({ where: { orderId } }),
      tx.dispute.count({ where: { orderId } }),
      tx.shipment.count({ where: { orderId } }),
      tx.sellerFinancialRecord.count({ where: { orderId } }),
      tx.review.count({ where: { orderId } }),
      tx.sellerReview.count({ where: { orderId } }),
      tx.refundOperationItem.count({
        where: { orderItem: { orderId } },
      }),
      tx.auditLog.count({
        where: {
          resourceType: "Order",
          resourceId: orderId,
        },
      }),
    ]);

    if (
      refunds ||
      returns ||
      disputes ||
      shipments ||
      financialRecords ||
      reviews ||
      sellerReviews ||
      refundItems ||
      orderAuditLogs
    ) {
      return false;
    }

    // Delete the failed payment first because its relation does not cascade.
    await tx.payment.delete({
      where: { orderId },
    });

    await tx.order.delete({
      where: { id: orderId },
    });

    return true;
  });
}