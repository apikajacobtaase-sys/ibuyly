// src/tests/security/invitations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    adminInvitation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      user: { update: vi.fn() },
      adminInvitation: { update: vi.fn() },
    })),
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

import { POST } from '@/app/api/admin/invitations/redeem/route';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';

describe('Invitation Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject expired invitations', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'CUSTOMER' },
    } as any);

    vi.mocked(db.adminInvitation.findUnique).mockResolvedValue({
      id: 'inv1',
      email: 'test@example.com',
      role: 'ADMIN',
      tokenHash: 'hashed',
      expiresAt: new Date(Date.now() - 1000), // 👈 Expired 1 second ago
      revokedAt: null,
      redeemedAt: null,
    } as any);

    const request = new Request('http://localhost:3000/api/admin/invitations/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: 'inv1', rawToken: 'valid-token' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('expired');
  });

  it('should reject revoked invitations', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'CUSTOMER' },
    } as any);

    vi.mocked(db.adminInvitation.findUnique).mockResolvedValue({
      id: 'inv1',
      email: 'test@example.com',
      role: 'ADMIN',
      tokenHash: 'hashed',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(), // 👈 Already revoked
      redeemedAt: null,
    } as any);

    const request = new Request('http://localhost:3000/api/admin/invitations/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: 'inv1', rawToken: 'valid-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should reject already-redeemed invitations (single-use)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'CUSTOMER' },
    } as any);

    vi.mocked(db.adminInvitation.findUnique).mockResolvedValue({
      id: 'inv1',
      email: 'test@example.com',
      role: 'ADMIN',
      tokenHash: 'hashed',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      redeemedAt: new Date(), // 👈 Already redeemed
    } as any);

    const request = new Request('http://localhost:3000/api/admin/invitations/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: 'inv1', rawToken: 'valid-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should reject invitations sent to a different email', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user1', email: 'attacker@evil.com' }, // 👈 Different email
    } as any);

    vi.mocked(db.adminInvitation.findUnique).mockResolvedValue({
      id: 'inv1',
      email: 'victim@example.com', // 👈 Invitation sent to someone else
      role: 'ADMIN',
      tokenHash: 'hashed',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      redeemedAt: null,
    } as any);

    const request = new Request('http://localhost:3000/api/admin/invitations/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: 'inv1', rawToken: 'valid-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should reject invalid tokens', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user1', email: 'test@example.com', role: 'CUSTOMER' },
    } as any);

    vi.mocked(db.adminInvitation.findUnique).mockResolvedValue({
      id: 'inv1',
      email: 'test@example.com',
      role: 'ADMIN',
      tokenHash: 'hashed',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      redeemedAt: null,
    } as any);

    vi.mocked(bcrypt.compare).mockResolvedValue(false); // 👈 Invalid token

    const request = new Request('http://localhost:3000/api/admin/invitations/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId: 'inv1', rawToken: 'wrong-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});