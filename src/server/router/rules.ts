import "server-only";

/**
 * The rules layer. A deterministic check that runs before any model call.
 *
 * rules/ai.md: a hit refuses immediately with no network call at all. It is not
 * weighed against the router's opinion and there is no tie break, because a
 * model classifier is probabilistic and these boundaries cannot rest on one
 * behaving.
 *
 * The five categories come from rules/ai.md. They are checked in that order and
 * the first hit wins, so the same question always gets the same category.
 *
 * This module is pure on purpose. The member name list is a parameter, not a
 * database read, so the rule is testable without a database and the loader can
 * be reviewed on its own. rules/ai.md: the list is loaded from the database and
 * refreshed hourly.
 */

export type RefusalCategory =
  | "medical"
  | "another_member"
  | "door_access"
  | "money_decision"
  | "staff_conduct";

export interface Refusal {
  category: RefusalCategory;
  /**
   * Which half of the rule fired. The matched text is deliberately not
   * returned: for a name hit that text is another member's name, and rules/
   * privacy.md keeps private values out of error messages and logs.
   */
  matchedBy: "pattern" | "member_name";
  /** Stable id for the audit trail. Never the question text. */
  patternId: string;
}

export interface QuestionContext {
  question: string;
  /** The asking member's own name. A question naming her does not trigger. */
  selfName: string | null;
  /** Every member name in the gym. Loaded and refreshed by the caller. */
  memberNames: readonly string[];
}

interface NeverAnswerPattern {
  id: string;
  category: RefusalCategory;
  pattern: RegExp;
}

/**
 * A starting list, not a finding. Every phrase here is a proposal to the owner
 * for review: a false positive sends the member to a named person, which is a
 * safe failure, and a false negative is caught by nothing except the router.
 *
 * The lists are deliberately narrower than their categories in three places,
 * because a broader pattern would swallow a shared card that exists:
 * - "cancel" alone is not a hit. Pause and cancellation terms are a card.
 * - "trainer" and "staff" alone are not hits. Trainer guidance is a card.
 * - "open" and "hours" alone are not hits. Access hours is a card.
 *
 * No pattern carries the `g` flag, so matching is stateless and repeatable.
 */
const NEVER_ANSWER_PATTERNS: readonly NeverAnswerPattern[] = [
  {
    id: "medical.symptom",
    category: "medical",
    pattern:
      /\b(injur(y|ies|ed)|pain(ful)?|hurt(s|ing)?|sore|ach(e|es|ing|y)|sick|illness|unwell|fever|infection|surgery)\b/i,
  },
  {
    id: "medical.care",
    category: "medical",
    pattern:
      /\b(doctor|hospital|clinic|pharmacy|nurse|medicine|medication|meds|drug|drugs|supplements?|diet|dieting|nutrition)\b/i,
  },
  {
    id: "medical.condition",
    category: "medical",
    pattern:
      /\b(pregnan(t|cy)|allerg(y|ies|ic)|asthma|diabet(es|ic)|blood pressure|mental health|depress(ed|ion)|anxiety|anxious)\b/i,
  },
  {
    id: "medical.treatment",
    category: "medical",
    pattern: /\b(physio|physiotherapy|therapy|therapist|weight loss|lose weight|calories?)\b/i,
  },
  {
    id: "medical.safety",
    category: "medical",
    pattern:
      /\b(safe|ok|okay|alright) (for me )?to (train|exercise|work ?out|lift|run|jog|swim)\b|\bwith (an |a |my )?(injury|pain|sore|hurt)\b/i,
  },
  {
    id: "another_member.person",
    category: "another_member",
    pattern:
      /\b(another member|other members?|someone else('s)?|anyone else|who else|which members?)\b/i,
  },
  {
    id: "another_member.details",
    category: "another_member",
    pattern:
      /\b(member (number|details|info|information|phone|email|address)|phone number|email address) of (a|the|that) member\b/i,
  },
  {
    id: "another_member.records",
    category: "another_member",
    pattern:
      /\b(attendance|check ?ins?) of (a|the|that) member\b|\bhow many members (came|checked in|attended|are in)\b/i,
  },
  {
    id: "door_access.door",
    category: "door_access",
    pattern: /\b(door|gate|keypad|buzzer|unlock)\b/i,
  },
  {
    id: "door_access.entry",
    category: "door_access",
    pattern: /\b(let me in|getting in (right )?now|get in (right )?now|open (the )?(door|gate))\b/i,
  },
  {
    id: "money_decision.refund",
    category: "money_decision",
    pattern: /\b(refund(s|ed|ing)?|waiv(e|er|ers|ing)|discount(s|ed|ing)?|money back)\b/i,
  },
  {
    id: "money_decision.price",
    category: "money_decision",
    pattern:
      /\b(cheaper|price match|lower the price|reduce the price|special price|free (month|week|session|membership)|negotiate)\b/i,
  },
  {
    id: "money_decision.decision",
    category: "money_decision",
    pattern:
      /\b(can|could|will|would) you (please )?cancel\b|\bcancel (my|the) (fee|fees|charge|charges|payment)\b|\bapprove (my|the|this) (cancel|cancellation|refund|waiver)\b|\bmake an exception\b/i,
  },
  {
    id: "staff_conduct.behaviour",
    category: "staff_conduct",
    pattern:
      /\b(rude|unprofessional|disrespectful|unhelpful|harass(ed|ment)?|misconduct)\b/i,
  },
  {
    id: "staff_conduct.complaint",
    category: "staff_conduct",
    pattern:
      /\b(complain(t|ed|ing)?|report (a |the )?(staff|trainer|instructor|coach|employee|front desk)|(staff|trainer|instructor|coach) (was|is|being|behaved|behaving))\b/i,
  },
  {
    id: "staff_conduct.dispute",
    category: "staff_conduct",
    pattern: /\b(stole|stealing|theft|fight|fighting|argument|argued|lawsuit|sue|legal action)\b/i,
  },
];

function normalise(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameAppears(question: string, name: string): boolean {
  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return false;
  }

  return new RegExp(`\\b${escapeRegExp(normalise(trimmed))}\\b`, "i").test(question);
}

/**
 * Returns the refusal category, or null when the question may go on to the
 * router.
 *
 * A member naming herself does not trigger the another member rule, but a
 * pattern hit in any category still refuses: her own name does not make an
 * otherwise refusable question answerable.
 */
export function checkNeverAnswer(context: QuestionContext): Refusal | null {
  const question = normalise(context.question);

  if (question.trim().length === 0) {
    return null;
  }

  for (const entry of NEVER_ANSWER_PATTERNS) {
    if (entry.pattern.test(question)) {
      return {
        category: entry.category,
        matchedBy: "pattern",
        patternId: entry.id,
      };
    }
  }

  const selfName =
    context.selfName && context.selfName.trim().length > 0
      ? normalise(context.selfName.trim())
      : null;

  for (const name of context.memberNames) {
    if (normalise(name.trim()) === selfName) {
      continue;
    }

    if (nameAppears(question, name)) {
      return {
        category: "another_member",
        matchedBy: "member_name",
        patternId: "another_member.name",
      };
    }
  }

  return null;
}
