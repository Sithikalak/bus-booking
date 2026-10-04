import { describe, it, expect } from "vitest";
import { validCard, validExpiry, mockCardToken } from "./payment";
describe("Development payment validation", () => {
  it("accepts valid test cards and rejects incorrect checksums", () => {
    expect(validCard("4242 4242 4242 4242")).toBe(true);
    expect(validCard("4242 4242 4242 4243")).toBe(false);
    expect(validCard("not a card")).toBe(false);
  });
  it("rejects expired or invalid dates", () => {
    expect(validExpiry("12/99")).toBe(true);
    expect(validExpiry("12/20")).toBe(false);
    expect(validExpiry("13/99")).toBe(false);
  });
  it("turns the decline card into a development token", () => {
    expect(mockCardToken("4000 0000 0000 0002")).toBe("mock_decline");
    expect(mockCardToken("4242 4242 4242 4242")).toBe("mock_success");
  });
});
