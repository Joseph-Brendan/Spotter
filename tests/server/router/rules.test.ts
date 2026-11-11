import { describe, expect, it } from "vitest";
import {
  checkNeverAnswer,
  type QuestionContext,
} from "@/server/router/rules";

function ask(question: string, overrides: Partial<QuestionContext> = {}) {
  return checkNeverAnswer({
    question,
    selfName: null,
    memberNames: [],
    ...overrides,
  });
}

describe("checkNeverAnswer", () => {
  it("refuses each of the five categories", () => {
    expect(ask("My knee pain is bad, should I train?")?.category).toBe("medical");
    expect(ask("What is the balance of another member?")?.category).toBe(
      "another_member"
    );
    expect(ask("Will the door open for me now?")?.category).toBe("door_access");
    expect(ask("Can I get a refund for this month?")?.category).toBe(
      "money_decision"
    );
    expect(ask("The trainer was rude to me")?.category).toBe("staff_conduct");
  });

  it("is case insensitive and ignores surrounding whitespace", () => {
    expect(ask("   WILL THE DOOR OPEN   ")?.category).toBe("door_access");
    expect(ask("can i get a REFUND")?.category).toBe("money_decision");
  });

  it("returns the first category in the fixed order", () => {
    expect(
      ask("Another member says her injury needs a refund")?.category
    ).toBe("medical");
  });

  it("refuses the nearest false positive on purpose, and the card questions pass", () => {
    // Door phrasing is a safe failure: it is refused rather than answered.
    expect(ask("What time does the door open?")?.category).toBe("door_access");

    // The shared cards these could have swallowed still reach the router.
    expect(ask("What time do you open on Sunday?")).toBeNull();
    expect(ask("What are the cancellation terms?")).toBeNull();
    expect(ask("How do I cancel my membership?")).toBeNull();
    expect(ask("Is there a guest policy?")).toBeNull();
    expect(ask("Who is the trainer on duty?")).toBeNull();
    expect(ask("Can I train on Sunday?")).toBeNull();
    expect(ask("What is the balance on my account?")).toBeNull();
    expect(ask("Is it safe to bring a guest?")).toBeNull();
  });

  it("refuses a named member but not the caller's own name", () => {
    const memberNames = ["Ada Obi", "Bola Eze"];

    expect(
      ask("Is Bola Eze coming today?", { selfName: "Ada Obi", memberNames })
        ?.matchedBy
    ).toBe("member_name");

    expect(
      ask("When does Ada Obi usually train?", {
        selfName: "Ada Obi",
        memberNames,
      })
    ).toBeNull();
  });

  it("still refuses on a pattern when the question also names the caller", () => {
    expect(
      ask("Ada Obi wants a refund, can you cancel my membership?", {
        selfName: "Ada Obi",
        memberNames: ["Ada Obi"],
      })?.category
    ).toBe("money_decision");
  });

  it("matches names at word boundaries only", () => {
    expect(
      ask("Is Adaeze around?", { memberNames: ["Ada"] })
    ).toBeNull();
  });

  it("returns null for an empty question", () => {
    expect(ask("")).toBeNull();
    expect(ask("   ")).toBeNull();
  });
});
