"use client";

import { useActionState } from "react";
import {
  createMemberAction,
  createMembershipPlanAction,
  updateMemberAction,
  updateMembershipPlanAction,
} from "@/app/staff/actions";
import styles from "@/app/staff/staff.module.css";
import { copy } from "@/lib/copy";
import type {
  ManagedMember,
  ManagedMembershipPlan,
  ManagementActionState,
  MembershipManagementData,
} from "@/types/staff";

const INITIAL_STATE: ManagementActionState = { status: "idle" };

function FormStatus({ state }: { state: ManagementActionState }) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={
        state.status === "error"
          ? `text-body-small ${styles.error}`
          : `text-body-small ${styles.success}`
      }
    >
      {state.error ?? state.message}
    </p>
  );
}

function MemberFields({ member }: { member?: ManagedMember }) {
  return (
    <div className={styles.formGrid}>
      <label className={styles.field}>
        <span className={`text-label-medium ${styles.label}`}>
          {copy.staff.nameLabel}
        </span>
        <input
          name="name"
          defaultValue={member?.name}
          minLength={2}
          required
          autoComplete="name"
          className={`text-body-medium ${styles.input}`}
        />
      </label>

      <label className={styles.field}>
        <span className={`text-label-medium ${styles.label}`}>
          {copy.staff.memberNumberLabel}
        </span>
        <input
          name="memberNumber"
          defaultValue={member?.memberNumber}
          inputMode="numeric"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          className={`text-body-medium ${styles.input}`}
        />
      </label>

      <label className={styles.field}>
        <span className={`text-label-medium ${styles.label}`}>
          {copy.staff.phoneLabel}
        </span>
        <input
          name="phone"
          type="tel"
          defaultValue={member?.phone}
          autoComplete="tel"
          className={`text-body-medium ${styles.input}`}
        />
      </label>

      <label className={styles.field}>
        <span className={`text-label-medium ${styles.label}`}>
          {copy.staff.tierLabel}
        </span>
        <select
          name="tier"
          defaultValue={member?.tier ?? "BASIC"}
          required
          className={`text-body-medium ${styles.input}`}
        >
          <option value="BASIC">Basic</option>
          <option value="PREMIUM">Premium</option>
        </select>
      </label>

      <label className={styles.field}>
        <span className={`text-label-medium ${styles.label}`}>
          {copy.staff.expiryDateLabel}
        </span>
        <input
          name="expiryDate"
          type="date"
          defaultValue={member?.expiryDate}
          required
          className={`text-body-medium ${styles.input}`}
        />
      </label>

      <label className={styles.field}>
        <span className={`text-label-medium ${styles.label}`}>
          {copy.staff.openingBalanceLabel}
        </span>
        <input
          name="openingBalanceKobo"
          type="number"
          step="1"
          defaultValue={member?.openingBalanceKobo ?? 0}
          required
          className={`text-body-medium ${styles.input}`}
        />
        <span className={`text-body-small ${styles.fieldHint}`}>
          {copy.staff.openingBalanceHint}
        </span>
      </label>
    </div>
  );
}

function CreateMemberForm() {
  const [state, action, pending] = useActionState(
    createMemberAction,
    INITIAL_STATE
  );

  return (
    <form action={action} className={styles.managementForm}>
      <h3 className={`text-title-medium ${styles.sectionTitle}`}>
        {copy.staff.addMember}
      </h3>
      <MemberFields />
      <FormStatus state={state} />
      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? copy.staff.saving : copy.staff.addMember}
      </button>
    </form>
  );
}

function EditMemberForm({ member }: { member: ManagedMember }) {
  const [state, action, pending] = useActionState(
    updateMemberAction,
    INITIAL_STATE
  );

  return (
    <details className={styles.record}>
      <summary className={styles.recordSummary}>
        <span>
          <strong>{member.name}</strong>
          <span className={`text-body-small ${styles.recordMeta}`}>
            #{member.memberNumber} · {member.tier.toLowerCase()}
          </span>
        </span>
        <span className={`text-label-small ${styles.accountState}`}>
          {member.hasAccount
            ? copy.staff.accountReady
            : copy.staff.awaitingSignup}
        </span>
      </summary>
      <form action={action} className={styles.managementForm}>
        <input type="hidden" name="id" value={member.id} />
        <MemberFields member={member} />
        <FormStatus state={state} />
        <button type="submit" disabled={pending} className={styles.button}>
          {pending ? copy.staff.saving : copy.staff.saveMember}
        </button>
      </form>
    </details>
  );
}

function PlanFields({ plan }: { plan?: ManagedMembershipPlan }) {
  return (
    <div className={styles.formGrid}>
      <label className={styles.field}>
        <span className={`text-label-medium ${styles.label}`}>
          {copy.staff.tierLabel}
        </span>
        <select
          name="tier"
          defaultValue={plan?.tier ?? "BASIC"}
          required
          className={`text-body-medium ${styles.input}`}
        >
          <option value="BASIC">Basic</option>
          <option value="PREMIUM">Premium</option>
        </select>
      </label>

      <label className={styles.field}>
        <span className={`text-label-medium ${styles.label}`}>
          {copy.staff.priceKoboLabel}
        </span>
        <input
          name="priceKobo"
          type="number"
          min="0"
          step="1"
          defaultValue={plan?.priceKobo ?? 0}
          required
          className={`text-body-medium ${styles.input}`}
        />
      </label>

      <label className={styles.field}>
        <span className={`text-label-medium ${styles.label}`}>
          {copy.staff.durationDaysLabel}
        </span>
        <input
          name="durationDays"
          type="number"
          min="1"
          step="1"
          defaultValue={plan?.durationDays ?? 30}
          required
          className={`text-body-medium ${styles.input}`}
        />
      </label>
    </div>
  );
}

function CreatePlanForm() {
  const [state, action, pending] = useActionState(
    createMembershipPlanAction,
    INITIAL_STATE
  );

  return (
    <form action={action} className={styles.managementForm}>
      <h3 className={`text-title-medium ${styles.sectionTitle}`}>
        {copy.staff.addPlan}
      </h3>
      <PlanFields />
      <FormStatus state={state} />
      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? copy.staff.saving : copy.staff.addPlan}
      </button>
    </form>
  );
}

function EditPlanForm({ plan }: { plan: ManagedMembershipPlan }) {
  const [state, action, pending] = useActionState(
    updateMembershipPlanAction,
    INITIAL_STATE
  );

  return (
    <details className={styles.record}>
      <summary className={styles.recordSummary}>
        <span>
          <strong>{plan.tier === "BASIC" ? "Basic" : "Premium"}</strong>
          <span className={`text-body-small ${styles.recordMeta}`}>
            {plan.priceKobo.toLocaleString()} kobo · {plan.durationDays} days
          </span>
        </span>
      </summary>
      <form action={action} className={styles.managementForm}>
        <input type="hidden" name="id" value={plan.id} />
        <PlanFields plan={plan} />
        <FormStatus state={state} />
        <button type="submit" disabled={pending} className={styles.button}>
          {pending ? copy.staff.saving : copy.staff.savePlan}
        </button>
      </form>
    </details>
  );
}

export default function MembershipManagement({
  data,
}: {
  data: MembershipManagementData;
}) {
  return (
    <>
      <section className={styles.card} aria-labelledby="member-list-title">
        <header className={styles.cardHeader}>
          <h2
            id="member-list-title"
            className={`text-title-large ${styles.title}`}
          >
            {copy.staff.memberManagementTitle}
          </h2>
          <p className={`text-body-small ${styles.subtitle}`}>
            {copy.staff.memberManagementSubtitle}
          </p>
        </header>
        <div className={styles.cardBody}>
          <CreateMemberForm />
          <div className={styles.recordList}>
            {data.members.length === 0 ? (
              <p className={`text-body-small ${styles.hint}`}>
                {copy.staff.noMembers}
              </p>
            ) : (
              data.members.map((member) => (
                <EditMemberForm
                  key={`${member.id}:${member.name}:${member.memberNumber}:${member.phone}:${member.tier}:${member.expiryDate}:${member.openingBalanceKobo}`}
                  member={member}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="plan-list-title">
        <header className={styles.cardHeader}>
          <h2
            id="plan-list-title"
            className={`text-title-large ${styles.title}`}
          >
            {copy.staff.planManagementTitle}
          </h2>
          <p className={`text-body-small ${styles.subtitle}`}>
            {copy.staff.planManagementSubtitle}
          </p>
        </header>
        <div className={styles.cardBody}>
          <CreatePlanForm />
          <div className={styles.recordList}>
            {data.plans.length === 0 ? (
              <p className={`text-body-small ${styles.hint}`}>
                {copy.staff.noPlans}
              </p>
            ) : (
              data.plans.map((plan) => (
                <EditPlanForm
                  key={`${plan.id}:${plan.tier}:${plan.priceKobo}:${plan.durationDays}`}
                  plan={plan}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
