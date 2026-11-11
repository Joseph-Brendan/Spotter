"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  getMembershipPlansAction,
  saveMembershipPlanAction,
} from "@/app/staff/actions";
import { copy } from "@/lib/copy";
import { formatKobo, koboToNairaInput, parseNairaToKobo } from "@/lib/money";
import type {
  MembershipPlansActionState,
  SaveMembershipPlanActionState,
  StaffMembershipPlan,
} from "@/types/staff";
import styles from "@/app/staff/staff.module.css";

const INITIAL_STATE: SaveMembershipPlanActionState = { status: "idle" };

type PlanTier = StaffMembershipPlan["tier"];

const TIERS: { tier: PlanTier; label: string }[] = [
  { tier: "BASIC", label: copy.staff.basicPlan },
  { tier: "PREMIUM", label: copy.staff.premiumPlan },
  { tier: "DIAMOND", label: copy.staff.diamondPlan },
];

interface PlanCardProps {
  tier: PlanTier;
  label: string;
  plan: StaffMembershipPlan | undefined;
  onSaved: (plan: StaffMembershipPlan) => void;
}

function PlanCard({ tier, label, plan, onSaved }: PlanCardProps) {
  const [editing, setEditing] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (
      previousState: SaveMembershipPlanActionState,
      formData: FormData
    ) => {
      const result = await saveMembershipPlanAction(previousState, formData);

      if (result.status === "success") {
        const priceInput = formData.get("price");
        const durationInput = formData.get("durationDays");
        const priceKobo =
          typeof priceInput === "string" ? parseNairaToKobo(priceInput) : null;
        const durationDays = Number(durationInput);

        if (
          priceKobo !== null &&
          Number.isInteger(durationDays) &&
          durationDays > 0
        ) {
          onSaved({ tier, priceKobo, durationDays });
        }

        setEditing(false);
        setShowSaved(true);
      }

      return result;
    },
    INITIAL_STATE
  );
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const wasEditingRef = useRef(false);

  const titleId = `plan-${tier}-title`;
  const priceId = `plan-price-${tier}`;
  const durationId = `plan-duration-${tier}`;
  const errorId = `plan-${tier}-error`;
  const showError = editing && state.status === "error" && Boolean(state.error);
  const priceInvalid = showError && state.error === copy.staff.planPriceInvalid;
  const durationInvalid =
    showError && state.error === copy.staff.planDurationInvalid;

  useEffect(() => {
    if (editing) {
      priceInputRef.current?.focus();
    } else if (wasEditingRef.current) {
      editButtonRef.current?.focus();
    }

    wasEditingRef.current = editing;
  }, [editing]);

  function openEditor() {
    setShowSaved(false);
    setEditing(true);
  }

  function closeEditor() {
    setEditing(false);
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      closeEditor();
    }
  }

  const cardClass = editing
    ? styles.planCardEditing
    : plan
      ? styles.planCardSet
      : styles.planCardEmpty;

  return (
    <li className={`${styles.planCard} ${cardClass}`}>
      <article className={styles.planCardInner} aria-labelledby={titleId}>
        <header className={styles.planCardHeader}>
          <h3 id={titleId} className={styles.planTierName}>
            {label}
          </h3>
          <span
            className={`${styles.planStatusBadge} ${
              plan ? styles.planStatusSet : styles.planStatusUnset
            }`}
          >
            {plan ? copy.staff.planSet : copy.staff.planNotSet}
          </span>
        </header>

        {editing ? (
          <form
            action={formAction}
            className={styles.planEditor}
            aria-labelledby={titleId}
            aria-busy={pending}
            onKeyDown={handleEditorKeyDown}
          >
            <input type="hidden" name="tier" value={tier} />

            <div className={styles.field}>
              <label
                htmlFor={priceId}
                className={`text-label-medium ${styles.label}`}
              >
                {copy.staff.priceLabel}
              </label>
              <div
                className={`${styles.inputGroup}${
                  priceInvalid ? ` ${styles.inputGroupInvalid}` : ""
                }`}
              >
                <span className={styles.inputAdornment} aria-hidden="true">
                  {copy.staff.planCurrencySymbol}
                </span>
                <input
                  ref={priceInputRef}
                  id={priceId}
                  name="price"
                  type="text"
                  inputMode="decimal"
                  required
                  autoComplete="off"
                  defaultValue={plan ? koboToNairaInput(plan.priceKobo) : ""}
                  aria-label={`${copy.staff.priceLabel}, ${label}`}
                  aria-invalid={priceInvalid || undefined}
                  aria-describedby={showError ? errorId : undefined}
                  className={`text-body-medium ${styles.inputGroupControl}`}
                  placeholder="15000"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label
                htmlFor={durationId}
                className={`text-label-medium ${styles.label}`}
              >
                {copy.staff.durationLabel}
              </label>
              <div
                className={`${styles.inputGroup}${
                  durationInvalid ? ` ${styles.inputGroupInvalid}` : ""
                }`}
              >
                <input
                  id={durationId}
                  name="durationDays"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  defaultValue={plan?.durationDays ?? ""}
                  aria-label={`${copy.staff.durationLabel}, ${label}`}
                  aria-invalid={durationInvalid || undefined}
                  aria-describedby={showError ? errorId : undefined}
                  className={`text-body-medium ${styles.inputGroupControl}`}
                  placeholder="30"
                />
                <span
                  className={`${styles.inputAdornment} ${styles.inputAdornmentEnd}`}
                  aria-hidden="true"
                >
                  {copy.staff.planDaysSuffix}
                </span>
              </div>
            </div>

            {showError && state.error && (
              <p
                id={errorId}
                role="alert"
                className={`text-body-small ${styles.formError}`}
              >
                {state.error}
              </p>
            )}

            <div className={styles.planEditorActions}>
              <button
                type="submit"
                disabled={pending}
                aria-label={`${
                  pending ? copy.staff.savingPlan : copy.staff.savePlan
                }, ${label}`}
                className={`${styles.button} ${styles.planEditorButton}`}
              >
                {pending ? copy.staff.savingPlan : copy.staff.savePlan}
              </button>
              <button
                type="button"
                disabled={pending}
                className={`${styles.secondaryButton} ${styles.planEditorButton}`}
                onClick={closeEditor}
              >
                {copy.staff.cancelEdit}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className={styles.planCardBody}>
              {plan ? (
                <p className={styles.planPrice}>
                  <span className={styles.planPriceAmount}>
                    {formatKobo(plan.priceKobo)}
                  </span>{" "}
                  <span className={styles.planPriceTerm}>
                    {copy.staff.planEveryDays(plan.durationDays)}
                  </span>
                </p>
              ) : (
                <p className={styles.planEmptyText}>
                  {copy.staff.planNotConfigured}
                </p>
              )}
            </div>

            <div className={styles.planCardFooter}>
              <button
                ref={editButtonRef}
                type="button"
                className={`${styles.secondaryButton} ${styles.planCardAction}${
                  plan ? "" : ` ${styles.planCardActionEmphasis}`
                }`}
                onClick={openEditor}
              >
                {plan
                  ? copy.staff.editPlanFor(label)
                  : copy.staff.setUpPlanFor(label)}
              </button>
            </div>
          </>
        )}

        <div role="status" className={styles.planSavedRegion}>
          {showSaved &&
            !editing &&
            state.status === "success" &&
            state.message && (
              <p className={`text-body-small ${styles.formSuccess}`}>
                {state.message}
              </p>
            )}
        </div>
      </article>
    </li>
  );
}

function PlansContent({
  plans,
  onSaved,
}: {
  plans: StaffMembershipPlan[];
  onSaved: (plan: StaffMembershipPlan) => void;
}) {
  const tierIsSet = TIERS.map(({ tier }) =>
    plans.some((plan) => plan.tier === tier)
  );
  const setCount = tierIsSet.filter(Boolean).length;

  return (
    <>
      <div className={styles.plansProgress}>
        <p className={`text-label-medium ${styles.plansCount}`}>
          {copy.staff.plansSetCount(setCount, TIERS.length)}
        </p>
        <span className={styles.plansMeter} aria-hidden="true">
          {tierIsSet.map((isSet, index) => (
            <span
              key={TIERS[index].tier}
              className={`${styles.plansMeterSegment}${
                isSet ? ` ${styles.plansMeterSegmentFilled}` : ""
              }`}
            />
          ))}
        </span>
      </div>

      {plans.length === 0 && (
        <p className={styles.ownerNotice} role="status">
          {copy.staff.plansRequired}
        </p>
      )}

      <ul className={styles.planGrid}>
        {TIERS.map(({ tier, label }) => (
          <PlanCard
            key={tier}
            tier={tier}
            label={label}
            plan={plans.find((plan) => plan.tier === tier)}
            onSaved={onSaved}
          />
        ))}
      </ul>
    </>
  );
}

interface PlansDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function PlansDrawer({ open, onClose }: PlansDrawerProps) {
  const drawerRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<MembershipPlansActionState | null>(null);

  useEffect(() => {
    let cancelled = false;

    getMembershipPlansAction()
      .then((result) => {
        if (!cancelled) {
          setState(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", error: copy.staff.plansLoadError });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const drawer = drawerRef.current;

    if (!drawer) {
      return;
    }

    if (open && !drawer.open) {
      drawer.showModal();
    } else if (!open && drawer.open) {
      drawer.close();
    }
  }, [open]);

  function handleSaved(savedPlan: StaffMembershipPlan) {
    setState((current) =>
      current?.status === "success"
        ? {
            status: "success",
            plans: [
              ...current.plans.filter((plan) => plan.tier !== savedPlan.tier),
              savedPlan,
            ],
          }
        : current
    );
  }

  return (
    <dialog
      ref={drawerRef}
      className={styles.plansDrawer}
      aria-labelledby="membership-plans-title"
      aria-describedby="membership-plans-description"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.plansDrawerInner}>
        <header className={styles.plansDrawerHeader}>
          <div className={styles.plansDrawerHeading}>
            <h2
              id="membership-plans-title"
              className={`text-title-large ${styles.plansDrawerTitle}`}
            >
              {copy.staff.plansTitle}
            </h2>
            <p
              id="membership-plans-description"
              className={`text-body-small ${styles.sectionSubtitle}`}
            >
              {copy.staff.plansSubtitle}
            </p>
          </div>
          <button
            type="button"
            className={styles.drawerClose}
            aria-label={copy.staff.plansClose}
            onClick={onClose}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </header>

        <div className={styles.plansDrawerBody}>
          {state === null && (
            <p role="status" className={`text-body-small ${styles.plansLoading}`}>
              {copy.staff.plansLoading}
            </p>
          )}

          {state?.status === "error" && (
            <div className={styles.plansError}>
              <p role="alert" className={`text-body-small ${styles.formError}`}>
                {state.error}
              </p>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setState(null);
                  getMembershipPlansAction()
                    .then(setState)
                    .catch(() =>
                      setState({
                        status: "error",
                        error: copy.staff.plansLoadError,
                      })
                    );
                }}
              >
                {copy.staff.plansRetry}
              </button>
            </div>
          )}

          {state?.status === "success" && (
            <PlansContent plans={state.plans} onSaved={handleSaved} />
          )}
        </div>
      </div>
    </dialog>
  );
}
