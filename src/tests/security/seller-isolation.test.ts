// src/tests/security/seller-isolation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    sellerProfile: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

import { GET as getProducts } from '@/app/api/seller/products/list/route';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';

describe('Seller Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should only return products owned by the authenticated seller', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'seller1', role: 'SELLER_OWNER' },
    } as any);

    vi.mocked(db.sellerProfile.findUnique).mockResolvedValue({
      id: 'seller-profile-1',
      userId: 'seller1',
    } as any);

    vi.mocked(db.product.findMany).mockResolvedValue([
      { id: 'p1', title: 'Seller 1 Product', sellerId: 'seller-profile-1' },
    ] as any);

    const request = new Request('http://localhost:3000/api/seller/products/list');
    const response = await getProducts(request);
    const data = await response.json();

    // CRITICAL: Verify the WHERE clause filters by seller ID
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sellerId: 'seller-profile-1', // ✅ Only this seller's products
        }),
      })
    );
  });

  it('should reject access when user has no seller profile', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'customer1', role: 'CUSTOMER' },
    } as any);

    vi.mocked(db.sellerProfile.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/seller/products/list');
    const response = await getProducts(request);

    expect(response.status).toBe(404);
    expect(db.product.findMany).not.toHaveBeenCalled(); // ✅ No data leaked
  });

  it('should reject unauthenticated requests', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/seller/products/list');
    const response = await getProducts(request);

    expect(response.status).toBe(401);
  });
});