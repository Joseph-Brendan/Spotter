"use client";

import { useActionState } from "react";
import { saveMembershipPlanAction } from "@/app/staff/actions";
import { copy } from "@/lib/copy";
import { formatKobo, koboToNairaInput } from "@/lib/money";
import type {
  SaveMembershipPlanActionState,
  StaffMembershipPlan,
} from "@/types/staff";
import styles from "@/app/staff/staff.module.css";

const INITIAL_STATE: SaveMembershipPlanActionState = { status: "idle" };

interface PlanFormProps {
  tier: "BASIC" | "PREMIUM" | "DIAMOND";
  label: string;
  plan: StaffMembershipPlan | undefined;
}

function PlanForm({ tier, label, plan }: PlanFormProps) {
  const [state, formAction, pending] = useActionState(
    saveMembershipPlanAction,
    INITIAL_STATE
  );

  return (
    <form action={formAction} className={styles.planForm}>
      <input type="hidden" name="tier" value={tier} />

      <div className={styles.planFormHeader}>
        <span className="text-title-small">{label}</span>
        <span className="text-body-small">
          {plan
            ? `${formatKobo(plan.priceKobo)} ${copy.staff.planEveryDays(
                plan.durationDays
              )}`
            : copy.staff.planNotSet}
        </span>
      </div>

      <div className={styles.planFields}>
        <div className={styles.field}>
          <label
            htmlFor={`plan-price-${tier}`}
            className={`text-label-medium ${styles.label}`}
          >
            {copy.staff.priceLabel}
          </label>
          <input
            id={`plan-price-${tier}`}
            name="price"
            type="text"
            inputMode="decimal"
            required
            defaultValue={plan ? koboToNairaInput(plan.priceKobo) : ""}
            className={`text-body-medium ${styles.input}`}
            placeholder="15000"
          />
        </div>

        <div className={styles.field}>
          <label
            htmlFor={`plan-duration-${tier}`}
            className={`text-label-medium ${styles.label}`}
          >
            {copy.staff.durationLabel}
          </label>
          <input
            id={`plan-duration-${tier}`}
            name="durationDays"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={plan?.durationDays ?? ""}
            className={`text-body-medium ${styles.input}`}
            placeholder="30"
          />
        </div>
      </div>

      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? copy.staff.savingPlan : copy.staff.savePlan}
      </button>

      {state.status === "success" && state.message && (
        <p role="status" className={`text-body-small ${styles.success}`}>
          {state.message}
        </p>
      )}

      {state.status === "error" && state.error && (
        <p role="alert" className={`text-body-small ${styles.error}`}>
          {state.error}
        </p>
      )}
    </form>
  );
}

interface MembershipPlansProps {
  plans: StaffMembershipPlan[];
}

export default function MembershipPlans({ plans }: MembershipPlansProps) {
  const basic = plans.find((plan) => plan.tier === "BASIC");
  const premium = plans.find((plan) => plan.tier === "PREMIUM");
  const diamond = plans.find((plan) => plan.tier === "DIAMOND");

  return (
    <section className={styles.card} aria-labelledby="membership-plans-title">
      <header className={styles.cardHeader}>
        <span className={`${styles.eyebrow} text-label-large`}>
          {copy.staff.roleOwner}
        </span>
        <h2
          id="membership-plans-title"
          className={`text-title-large ${styles.title}`}
        >
          {copy.staff.plansTitle}
        </h2>
        <p className={`text-body-small ${styles.subtitle}`}>
          {copy.staff.plansSubtitle}
        </p>
      </header>

      <div className={styles.cardBody}>
        {plans.length === 0 && (
          <div className={styles.ownerNotice} role="status">
            {copy.staff.plansRequired}
          </div>
        )}

        <PlanForm tier="BASIC" label={copy.staff.basicPlan} plan={basic} />
        <PlanForm
          tier="PREMIUM"
          label={copy.staff.premiumPlan}
          plan={premium}
        />
        <PlanForm
          tier="DIAMOND"
          label={copy.staff.diamondPlan}
          plan={diamond}
        />
      </div>
    </section>
  );
}
