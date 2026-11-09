import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  userFindUnique: vi.fn(),
  applicationFindUnique: vi.fn(),
  applicationUpdateMany: vi.fn(),
  applicationUpdate: vi.fn(),
  sellerProfileFindUnique: vi.fn(),
  sellerProfileCreate: vi.fn(),
  sellerProfileUpdate: vi.fn(),
  membershipUpsert: vi.fn(),
  transaction: vi.fn(),
  logAudit: vi.fn(),
  sendSellerApplicationEmail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    sellerApplication: {
      findMany: vi.fn(),
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

vi.mock("@/lib/email", () => ({
  sendSellerApplicationEmail: mocks.sendSellerApplicationEmail,
}));

import { POST } from "@/app/api/admin/applications/route";

const application = {
  id: "application-1",
  userId: "seller-user-1",
  businessName: "Jacob Electronics",
  businessType: "Electronics Retail",
  description: "An electronics retail business.",
  status: "PENDING",
  user: {
    id: "seller-user-1",
    email: "seller@example.com",
  },
  sellerProfile: null,
};

const tx = {
  sellerApplication: {
    findUnique: mocks.applicationFindUnique,
    updateMany: mocks.applicationUpdateMany,
    update: mocks.applicationUpdate,
  },
  sellerProfile: {
    findUnique: mocks.sellerProfileFindUnique,
    create: mocks.sellerProfileCreate,
    update: mocks.sellerProfileUpdate,
  },
  sellerMembership: {
    upsert: mocks.membershipUpsert,
  },
};

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/admin/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setAdmin(role: "ADMIN" | "SUPER_ADMIN") {
  mocks.getServerSession.mockResolvedValue({
    user: {
      id: "admin-1",
      email: "admin@example.com",
      role,
    },
  });

  mocks.userFindUnique.mockResolvedValue({
    id: "admin-1",
    email: "admin@example.com",
    role,
    isActive: true,
  });
}

describe("Admin seller application review security", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    setAdmin("SUPER_ADMIN");

    mocks.applicationFindUnique.mockResolvedValue(application);
    mocks.applicationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.applicationUpdate.mockResolvedValue({});
    mocks.sellerProfileFindUnique.mockResolvedValue(null);
    mocks.sellerProfileCreate.mockResolvedValue({
      id: "seller-profile-1",
    });
    mocks.sellerProfileUpdate.mockResolvedValue({});
    mocks.membershipUpsert.mockResolvedValue({});
    mocks.logAudit.mockResolvedValue(undefined);

    mocks.sendSellerApplicationEmail.mockResolvedValue({
      success: true,
    });

    mocks.transaction.mockImplementation(
      async (
        callback: (transaction: typeof tx) => Promise<unknown>
      ) => callback(tx)
    );
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "NEEDS_INFO",
        notes: "Please provide more information.",
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects inactive administrators", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      role: "SUPER_ADMIN",
      isActive: false,
    });

    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "NEEDS_INFO",
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects users without administrator permissions", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      role: "CUSTOMER",
      isActive: true,
    });

    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "NEEDS_INFO",
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows ADMIN to request additional information", async () => {
    setAdmin("ADMIN");

    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "NEEDS_INFO",
        notes: "Please provide your business registration documents.",
      })
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    expect(mocks.applicationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "application-1",
          status: {
            in: ["PENDING", "UNDER_REVIEW", "NEEDS_INFO"],
          },
        }),
        data: expect.objectContaining({
          status: "NEEDS_INFO",
          reviewedBy: "admin-1",
        }),
      })
    );

    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "SELLER_APPLICATION_INFO_REQUESTED",
      })
    );
  });

  it("prevents ADMIN from approving applications", async () => {
    setAdmin("ADMIN");

    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "APPROVE",
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("prevents ADMIN from rejecting applications", async () => {
    setAdmin("ADMIN");

    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "REJECT",
        reason: "Insufficient documentation.",
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires a rejection reason", async () => {
    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "REJECT",
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN to approve and create seller access", async () => {
    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "APPROVE",
        notes: "Verified successfully.",
      })
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    expect(mocks.sellerProfileCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "seller-user-1",
        businessName: "Jacob Electronics",
        verificationStatus: "VERIFIED",
        isActive: true,
      }),
    });

    expect(mocks.membershipUpsert).toHaveBeenCalledWith({
      where: {
        userId_sellerId: {
          userId: "seller-user-1",
          sellerId: "seller-profile-1",
        },
      },
      update: expect.objectContaining({
        role: "OWNER",
        canManageProducts: true,
        canManageSettings: true,
        isActive: true,
      }),
      create: expect.objectContaining({
        userId: "seller-user-1",
        sellerId: "seller-profile-1",
        role: "OWNER",
        isActive: true,
      }),
    });

    expect(mocks.applicationUpdate).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: { sellerProfileId: "seller-profile-1" },
    });

    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "SELLER_APPLICATION_APPROVED",
      })
    );
  });

  it("allows SUPER_ADMIN to reject applications", async () => {
    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "REJECT",
        reason: "Business documentation could not be verified.",
      })
    );

    expect(response.status).toBe(200);

    expect(mocks.applicationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: "Business documentation could not be verified.",
        }),
      })
    );

    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "SELLER_APPLICATION_REJECTED",
      })
    );
  });

  it("prevents processing an already reviewed application", async () => {
    mocks.applicationFindUnique.mockResolvedValue({
      ...application,
      status: "APPROVED",
    });

    const response = await POST(
      makeRequest({
        applicationId: "application-1",
        action: "APPROVE",
      })
    );

    expect(response.status).toBe(409);
    expect(mocks.applicationUpdateMany).not.toHaveBeenCalled();
    expect(mocks.sellerProfileCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed review data", async () => {
    const response = await POST(
      makeRequest({
        applicationId: "",
        action: "INVALID_ACTION",
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("uses serializable transaction isolation", async () => {
    await POST(
      makeRequest({
        applicationId: "application-1",
        action: "APPROVE",
      })
    );

    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" }
    );
  });
});