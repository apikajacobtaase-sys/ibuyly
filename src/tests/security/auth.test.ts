 import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

describe('Authentication Security', () => {
  it('should BLOCK login for SUSPENDED accounts', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user1',
      email: 'suspended@example.com',
      passwordHash: 'hashed',
      accountStatus: 'SUSPENDED',
      isActive: true,
      firstName: 'Bad',
      lastName: 'Actor',
    } as any);

    const authorize = authOptions.providers[0].options.authorize;

    await expect(
      authorize!(
        { email: 'suspended@example.com', password: 'Password123!' },
        {} as any
      )
    ).rejects.toThrow('unavailable');
  });

  it('should BLOCK login for DISABLED accounts', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user1',
      email: 'disabled@example.com',
      passwordHash: 'hashed',
      accountStatus: 'DISABLED',
      isActive: true,
      firstName: 'Disabled',
      lastName: 'User',
    } as any);

    const authorize = authOptions.providers[0].options.authorize;

    await expect(
      authorize!(
        { email: 'disabled@example.com', password: 'Password123!' },
        {} as any
      )
    ).rejects.toThrow('unavailable');
  });

  it('should ALLOW login for ACTIVE accounts with correct password', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user1',
      email: 'active@example.com',
      passwordHash: 'hashed',
      accountStatus: 'ACTIVE',
      isActive: true,
      firstName: 'Good',
      lastName: 'User',
    } as any);

    const authorize = authOptions.providers[0].options.authorize;

    const result = await authorize!(
      { email: 'active@example.com', password: 'Password123!' },
      {} as any
    );

    expect(result).toBeDefined();
    expect(result?.email).toBe('active@example.com');
  });

  it('should REJECT login with wrong password', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user1',
      email: 'user@example.com',
      passwordHash: 'hashed',
      accountStatus: 'ACTIVE',
      isActive: true,
      firstName: 'Test',
      lastName: 'User',
    } as any);

    const bcrypt = await import('bcryptjs');
    vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(false);

    const authorize = authOptions.providers[0].options.authorize;

    await expect(
      authorize!(
        { email: 'user@example.com', password: 'WrongPassword!' },
        {} as any
      )
    ).rejects.toThrow('Invalid');
  });
});