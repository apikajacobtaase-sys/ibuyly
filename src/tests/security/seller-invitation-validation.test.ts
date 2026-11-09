import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    sellerInvitation: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/seller/invitation/validate/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";

const token = "a".repeat(43);

const tokenHash = createHash("sha256")
  .update(token)
  .digest("hex");

const activeUser = {
  email: "seller@example.com",
  emailVerifiedAt: new Date(),
  isActive: true,
  sellerProfile: null,
};

const validInvitation = {
  email: "seller@example.com",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  redeemedAt: null,
  revokedAt: null,
  applicationId: null,
};

function makeRequest(value = token) {
  return new Request(
    `http://localhost:3000/api/seller/invitation/validate?token=${value}`
  );
}

describe("Seller invitation validation security", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", email: "seller@example.com" },
    } as any);

    vi.mocked(db.user.findUnique).mockResolvedValue(
      activeUser as any
    );

    vi.mocked(db.sellerInvitation.findUnique).mockResolvedValue(
      validInvitation as any
    );
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects inactive accounts", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...activeUser,
      isActive: false,
    } as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    expect(db.sellerInvitation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects accounts with unverified email addresses", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...activeUser,
      emailVerifiedAt: null,
    } as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    expect(db.sellerInvitation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects existing seller accounts", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...activeUser,
      sellerProfile: { id: "seller-1" },
    } as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(409);
  });

  it("rejects malformed invitation tokens", async () => {
    const response = await GET(makeRequest("invalid-token"));

    expect(response.status).toBe(400);
    expect(db.sellerInvitation.findUnique).not.toHaveBeenCalled();
  });

  it("rejects invitations belonging to another email", async () => {
    vi.mocked(db.sellerInvitation.findUnique).mockResolvedValue({
      ...validInvitation,
      email: "victim@example.com",
    } as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
  });

  it("rejects expired invitations", async () => {
    vi.mocked(db.sellerInvitation.findUnique).mockResolvedValue({
      ...validInvitation,
      expiresAt: new Date(Date.now() - 1000),
    } as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
  });

  it("rejects revoked invitations", async () => {
    vi.mocked(db.sellerInvitation.findUnique).mockResolvedValue({
      ...validInvitation,
      revokedAt: new Date(),
    } as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
  });

  it("rejects already redeemed invitations", async () => {
    vi.mocked(db.sellerInvitation.findUnique).mockResolvedValue({
      ...validInvitation,
      redeemedAt: new Date(),
    } as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
  });

  it("rejects invitations already linked to an application", async () => {
    vi.mocked(db.sellerInvitation.findUnique).mockResolvedValue({
      ...validInvitation,
      applicationId: "application-1",
    } as any);

    const response = await GET(makeRequest());

    expect(response.status).toBe(400);
  });

  it("accepts a valid invitation for the verified account", async () => {
    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);

    expect(db.sellerInvitation.findUnique).toHaveBeenCalledWith({
      where: { tokenHash },
      select: {
        email: true,
        expiresAt: true,
        redeemedAt: true,
        revokedAt: true,
        applicationId: true,
      },
    });
  });
});
