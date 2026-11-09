import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    sellerOffer: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/seller-auth", () => ({
  authorizeSeller: vi.fn(),
}));

import { GET } from "@/app/api/seller/products/route";
import { db } from "@/lib/db";
import { authorizeSeller } from "@/lib/seller-auth";

describe("Seller Tenant Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authorizeSeller).mockResolvedValue({
      authorized: true,
      userId: "seller1",
      sellerId: "seller-profile-1",
      isOwner: true,
    } as any);

    vi.mocked(db.sellerOffer.findMany).mockResolvedValue([] as any);
    vi.mocked(db.sellerOffer.count).mockResolvedValue(0);
  });

  it("should only query offers belonging to the authenticated seller", async () => {
    const request = new Request(
      "http://localhost:3000/api/seller/products"
    );

    const response = await GET(request);

    expect(response.status).toBe(200);

    expect(authorizeSeller).toHaveBeenCalledWith("manage_products");

    expect(db.sellerOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sellerId: "seller-profile-1",
        }),
      })
    );

    expect(db.sellerOffer.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        sellerId: "seller-profile-1",
      }),
    });
  });

  it("should reject users without seller access", async () => {
    vi.mocked(authorizeSeller).mockResolvedValue({
      authorized: false,
      response: new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403 }
      ),
    } as any);

    const request = new Request(
      "http://localhost:3000/api/seller/products"
    );

    const response = await GET(request);

    expect(response.status).toBe(403);
    expect(db.sellerOffer.findMany).not.toHaveBeenCalled();
    expect(db.sellerOffer.count).not.toHaveBeenCalled();
  });
});