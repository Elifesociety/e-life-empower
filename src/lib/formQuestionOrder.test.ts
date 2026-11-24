import { describe, expect, it } from "vitest";
import { moveQuestion } from "./formQuestionOrder";

describe("moveQuestion", () => {
  it("moves a question to the requested position and normalizes saved order", () => {
    const questions = [
      { id: "first", sort_order: 8 },
      { id: "second", sort_order: 14 },
      { id: "third", sort_order: 21 },
    ];

    expect(moveQuestion(questions, 2, 0)).toEqual([
      { id: "third", sort_order: 0 },
      { id: "first", sort_order: 1 },
      { id: "second", sort_order: 2 },
    ]);
    expect(questions.map((question) => question.id)).toEqual(["first", "second", "third"]);
  });

  it("leaves the order unchanged when the target position is outside the list", () => {
    const questions = [{ id: "only", sort_order: 0 }];

    expect(moveQuestion(questions, 0, 1)).toBe(questions);
  });
});