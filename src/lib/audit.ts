// src/lib/audit.ts
import { db } from "@/lib/db";

export async function logAudit(params: {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata: params.metadata || {},
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}