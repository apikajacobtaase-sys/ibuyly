import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  userFindUnique: vi.fn(),
  invitationFindUnique: vi.fn(),
  transaction: vi.fn(),
  applicationFindFirst: vi.fn(),
  invitationUpdateMany: vi.fn(),
  applicationCreate: vi.fn(),
  invitationUpdate: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    sellerInvitation: {
      findUnique: mocks.invitationFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));

import { POST } from "@/app/api/seller/apply/route";

const token = "a".repeat(43);

const tokenHash = createHash("sha256")
  .update(token)
  .digest("hex");

const applicationData = {
  token,
  businessName: "Jacob Electronics",
  businessType: "Electronics Retail",
  description: "A retail business selling quality electronic products.",
};

const activeUser = {
  id: "user-1",
  email: "seller@example.com",
  emailVerifiedAt: new Date(),
  isActive: true,
  sellerProfile: null,
};

const validInvitation = {
  id: "invitation-1",
  email: "seller@example.com",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  redeemedAt: null,
  revokedAt: null,
  applicationId: null,
};

const tx = {
  sellerApplication: {
    findFirst: mocks.applicationFindFirst,
    create: mocks.applicationCreate,
  },
  sellerInvitation: {
    updateMany: mocks.invitationUpdateMany,
    update: mocks.invitationUpdate,
  },
};

function makeRequest(body: unknown = applicationData) {
  return new Request("http://localhost:3000/api/seller/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Seller application submission security", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "seller@example.com" },
    });

    mocks.userFindUnique.mockResolvedValue(activeUser);

    mocks.invitationFindUnique.mockResolvedValue(validInvitation);

    mocks.applicationFindFirst.mockResolvedValue(null);

    mocks.invitationUpdateMany.mockResolvedValue({ count: 1 });

    mocks.applicationCreate.mockResolvedValue({
      id: "application-1",
    });

    mocks.invitationUpdate.mockResolvedValue(validInvitation);

    mocks.transaction.mockImplementation(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx)
    );

    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects malformed application data", async () => {
    const response = await POST(
      makeRequest({
        ...applicationData,
        token: "invalid",
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects unavailable accounts", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(mocks.invitationFindUnique).not.toHaveBeenCalled();
  });

  it("rejects inactive accounts", async () => {
    mocks.userFindUnique.mockResolvedValue({
      ...activeUser,
      isActive: false,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
  });

  it("rejects unverified email addresses", async () => {
    mocks.userFindUnique.mockResolvedValue({
      ...activeUser,
      emailVerifiedAt: null,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(mocks.invitationFindUnique).not.toHaveBeenCalled();
  });

  it("rejects existing seller accounts", async () => {
    mocks.userFindUnique.mockResolvedValue({
      ...activeUser,
      sellerProfile: { id: "seller-1" },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(mocks.invitationFindUnique).not.toHaveBeenCalled();
  });

  it("rejects invitations belonging to another email", async () => {
    mocks.invitationFindUnique.mockResolvedValue({
      ...validInvitation,
      email: "victim@example.com",
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects expired invitations", async () => {
    mocks.invitationFindUnique.mockResolvedValue({
      ...validInvitation,
      expiresAt: new Date(Date.now() - 1000),
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects revoked invitations", async () => {
    mocks.invitationFindUnique.mockResolvedValue({
      ...validInvitation,
      revokedAt: new Date(),
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
  });

  it("rejects already redeemed invitations", async () => {
    mocks.invitationFindUnique.mockResolvedValue({
      ...validInvitation,
      redeemedAt: new Date(),
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
  });

  it("rejects applicants with an existing pending application", async () => {
    mocks.applicationFindFirst.mockResolvedValue({
      id: "existing-application",
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(mocks.invitationUpdateMany).not.toHaveBeenCalled();
    expect(mocks.applicationCreate).not.toHaveBeenCalled();
  });

  it("rejects an invitation that cannot be atomically redeemed", async () => {
    mocks.invitationUpdateMany.mockResolvedValue({ count: 0 });

    const response = await POST(makeRequest());

    expect(response.status).toBe(409);
    expect(mocks.applicationCreate).not.toHaveBeenCalled();
  });

  it("creates an application and links the redeemed invitation", async () => {
    const response = await POST(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.applicationId).toBe("application-1");

    expect(mocks.invitationFindUnique).toHaveBeenCalledWith({
      where: { tokenHash },
    });

    expect(mocks.invitationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "invitation-1",
          email: "seller@example.com",
          redeemedAt: null,
          revokedAt: null,
          applicationId: null,
        }),
      })
    );

    expect(mocks.applicationCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        businessName: "Jacob Electronics",
        businessType: "Electronics Retail",
        description: "A retail business selling quality electronic products.",
        status: "PENDING",
      },
    });

    expect(mocks.invitationUpdate).toHaveBeenCalledWith({
      where: { id: "invitation-1" },
      data: { applicationId: "application-1" },
    });

    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "SELLER_APPLICATION_SUBMITTED",
        resourceId: "application-1",
      })
    );
  });

  it("uses serializable transaction isolation", async () => {
    await POST(makeRequest());

    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" }
    );
  });
});
