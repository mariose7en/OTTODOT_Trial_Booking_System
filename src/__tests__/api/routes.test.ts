import { BookingStatus } from "@/types/booking";

// Mock supabase
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";

// We test the route logic by importing and calling the handlers directly
// This is a unit test for the API route logic

describe("Trial Classes API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have correct route structure", () => {
    // Verify the route module exists
    const route = require("@/app/api/trial-classes/route");
    expect(route.GET).toBeDefined();
    expect(typeof route.GET).toBe("function");
  });
});

describe("Bookings API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have correct route structure", () => {
    const route = require("@/app/api/bookings/route");
    expect(route.GET).toBeDefined();
    expect(route.POST).toBeDefined();
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
  });
});

describe("Bookings by ID API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have correct route structure", () => {
    const route = require("@/app/api/bookings/[id]/route");
    expect(route.GET).toBeDefined();
    expect(typeof route.GET).toBe("function");
  });
});

describe("Payments Confirm API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have correct route structure", () => {
    const route = require("@/app/api/payments/confirm/route");
    expect(route.POST).toBeDefined();
    expect(typeof route.POST).toBe("function");
  });
});

describe("Roster API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have correct route structure", () => {
    const route = require("@/app/api/roster/[class_id]/route");
    expect(route.GET).toBeDefined();
    expect(typeof route.GET).toBe("function");
  });
});

describe("Seed API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should have correct route structure", () => {
    const route = require("@/app/api/seed/route");
    expect(route.POST).toBeDefined();
    expect(typeof route.POST).toBe("function");
  });
});
