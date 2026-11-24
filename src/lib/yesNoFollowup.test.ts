import { describe, expect, it } from "vitest";
import { formatYesNoAnswer, isYesNoValid, normalizeFollowupType } from "./yesNoFollowup";

describe("yes/no follow-up", () => {
  it("requires a typed follow-up answer when Yes and follow-up is required", () => {
    const cfg = { type: "text" as const, required: true, options: [] };
    expect(isYesNoValid({ value: "yes", followup: [""] }, cfg, true)).toBe(false);
    expect(isYesNoValid({ value: "yes", followup: ["Details"] }, cfg, true)).toBe(true);
  });
  it("does not require a follow-up when No is chosen", () => {
    expect(isYesNoValid({ value: "no", followup: [] }, { type: "date", required: true, options: [] }, true)).toBe(true);
  });
  it("keeps old saved questions working as multiple choice", () => {
    expect(normalizeFollowupType(undefined)).toBe("checkbox");
    expect(normalizeFollowupType("date")).toBe("date");
  });
  it("shows typed follow-up answers with their prompt in registration summaries", () => {
    expect(formatYesNoAnswer({ value: "yes", followup: ["Details"] }, "Please explain")).toBe("Yes — Please explain: Details");
    expect(formatYesNoAnswer({ value: "no", followup: [] })).toBe("No");
  });
});
