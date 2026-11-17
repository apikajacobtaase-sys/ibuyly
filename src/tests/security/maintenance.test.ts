 import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/db", () => ({
  db: {
    platformSettings: {
      findUnique: mocks.findUnique,
    },
    $transaction: mocks.transaction,
  },
}));

import { GET, PATCH } from "@/app/api/admin/settings/route";

describe("Platform maintenance security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated administrators", async () => {
    mocks.requireAdmin.mockResolvedValue({
      user: null,
      error: Response.json({ error: "Authentication required" }, { status: 401 }),
    });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("allows ADMIN to view settings but not manage maintenance", async () => {
    mocks.requireAdmin.mockResolvedValue({
      user: { id: "admin-1", email: "admin@example.com", role: "ADMIN" },
      error: null,
    });

    mocks.findUnique.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canManageMaintenance).toBe(false);
    expect(data.settings.maintenanceMode).toBe(false);
  });

  it("rejects ADMIN attempting to change maintenance mode", async () => {
    mocks.requireAdmin.mockResolvedValue({
      user: { id: "admin-1", email: "admin@example.com", role: "ADMIN" },
      error: null,
    });

    const request = new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maintenanceMode: true }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain("Super Admin");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid maintenance settings", async () => {
    mocks.requireAdmin.mockResolvedValue({
      user: { id: "super-1", email: "super@example.com", role: "SUPER_ADMIN" },
      error: null,
    });

    const request = new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maintenanceMode: "true" }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN to enable maintenance and records an audit log", async () => {
  mocks.requireAdmin.mockResolvedValue({
    user: { id: "super-1", email: "super@example.com", role: "SUPER_ADMIN" },
    error: null,
  });

  const updated = {
    maintenanceMode: true,
    maintenanceMessage: "Scheduled maintenance",
    expectedBackAt: null,
    updatedAt: new Date(),
  };

  mocks.findUnique.mockResolvedValue({ maintenanceMode: false });
  mocks.upsert = vi.fn().mockResolvedValue(updated);
  mocks.auditCreate = vi.fn().mockResolvedValue({});

  mocks.transaction.mockImplementation(async (callback: any) =>
    callback({
      platformSettings: {
        findUnique: mocks.findUnique,
        upsert: mocks.upsert,
      },
      auditLog: {
        create: mocks.auditCreate,
      },
    })
  );

  const request = new Request("http://localhost/api/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maintenanceMode: true,
      maintenanceMessage: "Scheduled maintenance",
    }),
  });

  const response = await PATCH(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.success).toBe(true);
  expect(data.settings.maintenanceMode).toBe(true);
  expect(mocks.upsert).toHaveBeenCalled();
  expect(mocks.auditCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        action: "PLATFORM_MAINTENANCE_ENABLED",
        userId: "super-1",
      }),
    })
  );
});
});