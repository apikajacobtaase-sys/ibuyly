import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    platformSettings: {
      findUnique: mocks.findUnique,
    },
  },
}));

import { GET } from "@/app/api/maintenance-status/route";

describe("Public maintenance status API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active maintenance settings", async () => {
    const expectedBackAt = new Date("2026-11-15T10:00:00Z");

    mocks.findUnique.mockResolvedValue({
      maintenanceMode: true,
      maintenanceMessage: "Scheduled maintenance",
      expectedBackAt,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.maintenanceMode).toBe(true);
    expect(data.message).toBe("Scheduled maintenance");
    expect(data.expectedBackAt).toBe(expectedBackAt.toISOString());
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("defaults to maintenance disabled when settings do not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(data.maintenanceMode).toBe(false);
    expect(data.message).toBeNull();
    expect(data.expectedBackAt).toBeNull();
  });

  it("fails open when the database is unavailable", async () => {
    mocks.findUnique.mockRejectedValue(new Error("Database unavailable"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.maintenanceMode).toBe(false);
    expect(data.unavailable).toBe(true);
  });
});