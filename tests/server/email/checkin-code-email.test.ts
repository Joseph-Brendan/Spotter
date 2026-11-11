import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { formatDateTime } from "@/lib/dates";
import { buildCheckInCodeEmail } from "@/server/email/checkin-code-email";

const createdAt = new Date("2026-11-09T18:15:00.000Z");
const expiresAt = new Date("2026-11-09T18:30:00.000Z");

function build(name = "Chioma Adeyemi") {
  return buildCheckInCodeEmail({
    name,
    digits: "482913",
    createdAt,
    expiresAt,
    timeZone: "Africa/Lagos",
  });
}

describe("buildCheckInCodeEmail", () => {
  it("includes the code in the text and html", () => {
    const email = build();

    expect(email.subject).toBe(copy.checkinEmail.subject);
    expect(email.text).toContain("482913");
    expect(email.html).toContain("482913");
  });

  it("states the date and time it was generated and when it expires", () => {
    const email = build();
    const generated = copy.checkinEmail.generatedAt(
      formatDateTime(createdAt, "Africa/Lagos")
    );
    const expiry = copy.checkinEmail.expiresAt(
      formatDateTime(expiresAt, "Africa/Lagos")
    );

    expect(email.text).toContain(generated);
    expect(email.text).toContain(expiry);
    expect(email.html).toContain(generated);
    expect(email.html).toContain(expiry);
  });

  it("escapes the member name in the html", () => {
    const email = build("<script>alert(1)</script>");

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});
