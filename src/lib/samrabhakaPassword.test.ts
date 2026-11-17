import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./samrabhakaPassword";

describe("validateNewPassword", () => {
  it("accepts a six-character password", () => {
    expect(validateNewPassword("123456", "123456")).toBeNull();
  });

  it("rejects passwords shorter than six characters", () => {
    expect(validateNewPassword("12345", "12345")).toBe("New password must be at least 6 characters");
  });
});