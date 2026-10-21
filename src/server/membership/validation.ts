import "server-only";
import { z } from "zod";

const POSTGRES_INT_MIN = -2_147_483_648;
const POSTGRES_INT_MAX = 2_147_483_647;

const integerFromForm = (minimum: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : value,
    z.number().int().min(minimum).max(POSTGRES_INT_MAX)
  );

function isDateOnly(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

const optionalPhone = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const phone = value.trim();
    return phone === "" ? null : phone;
  },
  z.string().min(1).nullable()
);

const memberFields = {
  name: z.string().trim().min(2),
  memberNumber: z.string().trim().regex(/^\d{6}$/),
  phone: optionalPhone,
  tier: z.enum(["BASIC", "PREMIUM"]),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isDateOnly),
  openingBalanceKobo: integerFromForm(POSTGRES_INT_MIN),
};

export const createMemberSchema = z.object(memberFields);

export const updateMemberSchema = z.object({
  id: z.string().trim().min(1),
  ...memberFields,
});

const planFields = {
  tier: z.enum(["BASIC", "PREMIUM"]),
  priceKobo: integerFromForm(0),
  durationDays: integerFromForm(1),
};

export const createMembershipPlanSchema = z.object(planFields);

export const updateMembershipPlanSchema = z.object({
  id: z.string().trim().min(1),
  ...planFields,
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateMembershipPlanInput = z.infer<
  typeof createMembershipPlanSchema
>;
export type UpdateMembershipPlanInput = z.infer<
  typeof updateMembershipPlanSchema
>;
