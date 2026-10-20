// src/tests/security/registration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma client
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
  },
}));

import { POST } from '@/app/api/auth/register/route';
import { db } from '@/lib/db';

describe('Registration Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue({
      id: 'user123',
      email: 'test@example.com',
      role: 'CUSTOMER',
      accountStatus: 'ACTIVE',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: 'hashed',
      phone: null,
    } as any);
    vi.mocked(db.emailVerificationToken.create).mockResolvedValue({} as any);
    vi.mocked(db.auditLog.create).mockResolvedValue({} as any);
  });

  it('should ALWAYS assign CUSTOMER role, ignoring client-submitted role', async () => {
    // Attacker tries to self-assign SUPER_ADMIN
    const maliciousRequest = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Hacker',
        lastName: 'Man',
        email: 'hacker@evil.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        phone: '0241234567',
        acceptTerms: true,
        role: 'SUPER_ADMIN', // 👈 Malicious attempt
      }),
    });

    const response = await POST(maliciousRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    
    // CRITICAL: Verify the role passed to db.create is CUSTOMER, not SUPER_ADMIN
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'CUSTOMER', // ✅ Server overrides malicious role
        }),
      })
    );
  });

  it('should reject registration without Terms acceptance', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        acceptTerms: false, // 👈 Missing T&C
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Terms and Conditions');
  });

  it('should reject weak passwords', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'short', // 👈 Too short
        confirmPassword: 'short',
        acceptTerms: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should reject mismatched passwords', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword!', // 👈 Mismatch
        acceptTerms: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should reject invalid email format', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: 'not-an-email', // 👈 Invalid
        password: 'Password123!',
        confirmPassword: 'Password123!',
        acceptTerms: true,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});