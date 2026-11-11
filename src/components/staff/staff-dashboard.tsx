"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getMemberDetailsAction,
  logoutStaffAction,
  reserveMemberNumberAction,
} from "@/app/staff/actions";
import { copy } from "@/lib/copy";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatKobo } from "@/lib/money";
import MembershipPlans from "@/components/staff/membership-plans";
import type { MemberTier, MembershipStatus } from "@/types/member";
import type {
  MemberDetailsActionState,
  ReserveMemberNumberActionState,
  StaffMemberNumberPagination,
  StaffMemberNumberReservation,
} from "@/types/staff";
import styles from "@/app/staff/staff.module.css";

const INITIAL_STATE: ReserveMemberNumberActionState = { status: "idle" };

const MAIN_CONTENT_ID = "staff-main-content";
const RESERVE_ERROR_ID = "reserve-member-error";

const MEMBER_TIER_LABEL: Record<MemberTier, string> = {
  BASIC: copy.dashboard.tierBasic,
  PREMIUM: copy.dashboard.tierPremium,
  DIAMOND: copy.dashboard.tierDiamond,
};

const MEMBER_STATUS_CLASS: Record<MembershipStatus, string> = {
  new: styles.memberStatusNew,
  active: styles.memberStatusActive,
  grace: styles.memberStatusGrace,
  expired: styles.memberStatusExpired,
  cancelled: styles.memberStatusCancelled,
};

function memberNumberPageHref(page: number, search: string): string {
  const params = new URLSearchParams();

  if (search) {
    params.set("q", search);
  }

  params.set("page", String(page));

  return `/staff?${params.toString()}`;
}

function PageArrow({ direction }: { direction: "previous" | "next" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={direction === "previous" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

interface StaffDashboardProps {
  staff: {
    name: string;
    role: string;
  };
  memberNumbers: StaffMemberNumberReservation[];
  memberNumberPagination: StaffMemberNumberPagination;
  memberNumberSearchQuery: string;
  gymTimezone: string;
  canManagePlans: boolean;
}

export default function StaffDashboard({
  staff,
  memberNumbers,
  memberNumberPagination,
  memberNumberSearchQuery,
  gymTimezone,
  canManagePlans,
}: StaffDashboardProps) {
  const [state, formAction, pending] = useActionState(
    reserveMemberNumberAction,
    INITIAL_STATE
  );
  const formRef = useRef<HTMLFormElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const router = useRouter();
  const canViewMemberDetails = staff.role === "OWNER";
  const memberDialogRef = useRef<HTMLDialogElement>(null);
  const memberDetailsRequestRef = useRef(0);
  const memberDetailsTriggerRef = useRef<HTMLElement | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [selectedMemberNumber, setSelectedMemberNumber] = useState<
    string | null
  >(null);
  const [memberProfileState, setMemberProfileState] =
    useState<MemberDetailsActionState>({ status: "idle" });
  const [memberProfilePending, startMemberProfileTransition] = useTransition();

  const avatarInitial = Array.from(staff.name.trim())[0]?.toUpperCase() ?? "?";
  const {
    page: memberNumberPage,
    pageSize: memberNumberPageSize,
    totalCount: memberNumberTotalCount,
    totalPages: memberNumberTotalPages,
  } = memberNumberPagination;
  const memberNumberRangeStart =
    memberNumberTotalCount === 0
      ? 0
      : (memberNumberPage - 1) * memberNumberPageSize + 1;
  const memberNumberRangeEnd = Math.min(
    memberNumberPage * memberNumberPageSize,
    memberNumberTotalCount
  );
  const tableColumnCount = canViewMemberDetails ? 4 : 3;
  const generatedColumnIndex = tableColumnCount;
  const hasPreviousMemberNumberPage = memberNumberPage > 1;
  const hasNextMemberNumberPage =
    memberNumberPage < memberNumberTotalPages;
  const showError = state.status === "error" && Boolean(state.error);
  const emailIsInvalid =
    showError && state.error === copy.validation.emailInvalid;
  const emailDescribedBy = showError ? RESERVE_ERROR_ID : undefined;

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        avatarButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    const input = searchInputRef.current;

    if (input && document.activeElement !== input) {
      input.value = memberNumberSearchQuery;
    }
  }, [memberNumberSearchQuery]);

  useEffect(() => {
    const dialog = memberDialogRef.current;

    if (!dialog) {
      return;
    }

    if (memberDialogOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }

    const trigger = memberDetailsTriggerRef.current;
    memberDetailsTriggerRef.current = null;

    if (trigger?.isConnected) {
      trigger.focus();
    }
  }, [memberDialogOpen]);

  function navigateToMemberNumberSearch(query: string) {
    const params = new URLSearchParams();

    if (query) {
      params.set("q", query);
    }

    router.replace(
      params.toString() ? `/staff?${params.toString()}` : "/staff",
      { scroll: false }
    );
  }

  function handleMemberNumberSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = searchInputRef.current?.value.trim() ?? "";
    navigateToMemberNumberSearch(query);
  }

  function clearMemberNumberSearch() {
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
      searchInputRef.current.focus();
    }

    navigateToMemberNumberSearch("");
  }

  function openMemberDetails(
    memberNumber: string,
    trigger: HTMLElement | null
  ) {
    if (!canViewMemberDetails) {
      return;
    }

    memberDetailsTriggerRef.current = trigger;
    setSelectedMemberNumber(memberNumber);
    setMemberDialogOpen(true);
    loadMemberDetails(memberNumber);
  }

  function loadMemberDetails(memberNumber: string) {
    const requestId = memberDetailsRequestRef.current + 1;
    memberDetailsRequestRef.current = requestId;
    setMemberProfileState({ status: "idle" });

    startMemberProfileTransition(async () => {
      try {
        const result = await getMemberDetailsAction(memberNumber);

        if (memberDetailsRequestRef.current === requestId) {
          setMemberProfileState(result);
        }
      } catch {
        if (memberDetailsRequestRef.current === requestId) {
          setMemberProfileState({
            status: "error",
            error: copy.staff.memberDetailsError,
          });
        }
      }
    });
  }

  function closeMemberDetails() {
    memberDetailsRequestRef.current += 1;
    setMemberDialogOpen(false);
    setSelectedMemberNumber(null);
    setMemberProfileState({ status: "idle" });
  }

  const memberProfile =
    memberProfileState.status === "success"
      ? memberProfileState.profile
      : undefined;
  const memberProfileLoading =
    memberProfilePending || memberProfileState.status === "idle";
  const memberProfileExpires = memberProfile?.expiryDate
    ? formatDate(memberProfile.expiryDate, memberProfile.gymTimezone)
    : copy.staff.memberDetailsNotSet;
  const memberProfileRegistered = memberProfile?.registeredAt
    ? formatDate(memberProfile.registeredAt, memberProfile.gymTimezone)
    : copy.staff.memberDetailsNotSet;
  const memberProfileLastCheckIn = memberProfile?.lastCheckInAt
    ? formatDateTime(memberProfile.lastCheckInAt, memberProfile.gymTimezone)
    : copy.staff.memberDetailsNoCheckIns;
  const memberProfilePaidPlanTerms = memberProfile?.lastPayment
    ? copy.staff.memberDetailsPaidPlan(
        formatKobo(memberProfile.lastPayment.amountKobo),
        memberProfile.lastPayment.durationDays,
        formatDate(memberProfile.lastPayment.paidAt, memberProfile.gymTimezone)
      )
    : null;
  const memberAvatarInitial = memberProfile
    ? Array.from(memberProfile.name.trim())[0]?.toUpperCase() ?? "?"
    : "?";

  return (
    <div className={styles.dashboardPage}>
      <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
        {copy.staff.skipToContent}
      </a>

      <header className={styles.appBar}>
        <div className={styles.appBarInner}>
          <div className={styles.appBarBrand}>
            <span className={`${styles.brand} text-label-large`}>SPOTTER</span>
          </div>

          <div className={styles.accountMenu} ref={accountMenuRef}>
            <button
              ref={avatarButtonRef}
              type="button"
              className={styles.avatarButton}
              aria-expanded={accountMenuOpen}
              aria-controls="staff-account-panel"
              aria-label={`${copy.staff.accountMenu}, ${copy.staff.signedInAs} ${staff.name}`}
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">{avatarInitial}</span>
            </button>

            <div
              id="staff-account-panel"
              className={styles.accountPanel}
              hidden={!accountMenuOpen}
            >
              <p className={styles.accountIdentity}>
                <span className={styles.accountIdentityLabel}>
                  {copy.staff.signedInAs}
                </span>
                <span className={styles.accountIdentityName}>{staff.name}</span>
              </p>

              <form
                action={logoutStaffAction}
                className={styles.accountPanelForm}
              >
                <button type="submit" className={styles.logOutButton}>
                  {copy.staff.signOut}
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main
        id={MAIN_CONTENT_ID}
        className={styles.main}
        tabIndex={-1}
      >
        <header className={styles.pageHeader}>
          <div className={styles.pageHeading}>
            <h1 className={`text-headline-small ${styles.pageTitle}`}>
              {copy.staff.frontDesk}
            </h1>
            <p className={`text-body-medium ${styles.pageSubtitle}`}>
              {copy.staff.dashboardSubtitle}
            </p>
          </div>

          {canManagePlans && (
            <div className={styles.pageActions}>
              <MembershipPlans />
            </div>
          )}
        </header>

        <section className={styles.panel} aria-labelledby="member-numbers-title">
          <header className={styles.panelHeader}>
            <h2
              id="member-numbers-title"
              className={`text-title-large ${styles.panelTitle}`}
            >
              {copy.staff.memberNumbersTitle}
            </h2>
          </header>

          <div className={styles.panelBody}>
            <form
              ref={formRef}
              action={formAction}
              className={styles.reserveForm}
              aria-busy={pending}
            >
              <div className={styles.field}>
                <label
                  htmlFor="member-email"
                  className={`text-label-medium ${styles.label}`}
                >
                  {copy.staff.memberEmailLabel}
                </label>
                <div className={styles.reserveRow}>
                  <input
                    id="member-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    aria-describedby={emailDescribedBy}
                    aria-invalid={emailIsInvalid || undefined}
                    className={`text-body-medium ${styles.input} ${styles.reserveInput}${
                      emailIsInvalid ? ` ${styles.inputInvalid}` : ""
                    }`}
                    placeholder="member@example.com"
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className={`${styles.button} ${styles.reserveButton}`}
                  >
                    {pending ? copy.staff.generating : copy.staff.reserveButton}
                  </button>
                </div>
              </div>

              {showError && state.error && (
                <p
                  id={RESERVE_ERROR_ID}
                  role="alert"
                  className={`text-body-small ${styles.formError}`}
                >
                  {state.error}
                </p>
              )}

              {state.status === "success" && !pending && (
                <p
                  role="status"
                  className={`text-body-small ${
                    state.emailSent ? styles.formSuccess : styles.formError
                  }`}
                >
                  {state.emailSent
                    ? copy.staff.reservedHintEmailSent
                    : copy.staff.reservedHintEmailFailed}
                </p>
              )}
            </form>
          </div>

          <div className={styles.numberHistory}>
            <div className={styles.numberHistoryHeader}>
              <div className={styles.numberHistoryHeading}>
                <h3
                  id="member-number-history-title"
                  className={`text-title-medium ${styles.numberHistoryTitle}`}
                >
                  {copy.staff.memberNumberHistoryTitle}
                </h3>
                <p
                  id="member-number-history-description"
                  className={`text-body-small ${styles.numberHistoryDescription}`}
                >
                  {copy.staff.memberNumberHistoryTooltip}
                </p>
              </div>

              <form
                action="/staff"
                method="get"
                role="search"
                className={styles.tableSearch}
                onSubmit={handleMemberNumberSearch}
              >
                <label
                  htmlFor="member-number-search"
                  className={styles.visuallyHidden}
                >
                  {canViewMemberDetails
                    ? copy.staff.memberNumberSearchLabelOwner
                    : copy.staff.memberNumberSearchLabel}
                </label>
                <div className={styles.searchField}>
                  <svg
                    className={styles.searchIcon}
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
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    id="member-number-search"
                    name="q"
                    type="search"
                    defaultValue={memberNumberSearchQuery}
                    placeholder={
                      canViewMemberDetails
                        ? copy.staff.memberNumberSearchPlaceholderOwner
                        : copy.staff.memberNumberSearchPlaceholder
                    }
                    maxLength={100}
                    autoComplete="off"
                    spellCheck={false}
                    className={styles.searchInput}
                  />
                  <button
                    type="submit"
                    className={styles.searchClearButton}
                    aria-label={copy.staff.clearSearch}
                    title={copy.staff.clearSearch}
                    onClick={clearMemberNumberSearch}
                  >
                    <svg
                      width="16"
                      height="16"
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
                </div>
                <button
                  type="submit"
                  className={`${styles.secondaryButton} ${styles.searchSubmit}`}
                >
                  {copy.staff.searchButton}
                </button>
              </form>
            </div>

            {memberNumbers.length === 0 ? (
              <p className={`text-body-small ${styles.numberHistoryEmpty}`}>
                {memberNumberSearchQuery
                  ? copy.staff.memberNumberSearchEmpty
                  : copy.staff.memberNumberHistoryEmpty}
              </p>
            ) : (
              <>
                <div
                  className={styles.tableScroll}
                  role="region"
                  aria-labelledby="member-number-history-title"
                  tabIndex={0}
                >
                <table
                  role="table"
                  className={styles.numberTable}
                  aria-labelledby="member-number-history-title"
                  aria-describedby="member-number-history-description"
                  aria-colcount={tableColumnCount}
                >
                  <thead role="rowgroup">
                    <tr role="row">
                      <th role="columnheader" scope="col" aria-colindex={1}>
                        {copy.staff.memberNumberColumn}
                      </th>
                      <th role="columnheader" scope="col" aria-colindex={2}>
                        {copy.staff.statusColumn}
                      </th>
                      {canViewMemberDetails && (
                        <th role="columnheader" scope="col" aria-colindex={3}>
                          {copy.staff.emailColumn}
                        </th>
                      )}
                      <th
                        role="columnheader"
                        scope="col"
                        aria-colindex={generatedColumnIndex}
                      >
                        {copy.staff.generatedColumn}
                      </th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {memberNumbers.map((reservation) => {
                      const isActionable =
                        canViewMemberDetails && Boolean(reservation.claimedAt);

                      return (
                        <tr
                          key={reservation.memberNumber}
                          role="row"
                          className={
                            isActionable ? styles.clickableRow : undefined
                          }
                          onClick={
                            isActionable
                              ? (event) =>
                                  openMemberDetails(
                                    reservation.memberNumber,
                                    event.currentTarget.querySelector("button")
                                  )
                              : undefined
                          }
                        >
                          <th
                            role="rowheader"
                            scope="row"
                            aria-colindex={1}
                            className={styles.numberCell}
                          >
                            {isActionable ? (
                              <button
                                type="button"
                                className={styles.memberNumberButton}
                                aria-label={copy.staff.memberDetailsViewFor(
                                  reservation.memberNumber
                                )}
                                aria-haspopup="dialog"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openMemberDetails(
                                    reservation.memberNumber,
                                    event.currentTarget
                                  );
                                }}
                              >
                                <span
                                  aria-hidden="true"
                                  className={styles.numberHash}
                                >
                                  #
                                </span>
                                {reservation.memberNumber}
                              </button>
                            ) : (
                              <>
                                <span
                                  aria-hidden="true"
                                  className={styles.numberHash}
                                >
                                  #
                                </span>
                                {reservation.memberNumber}
                              </>
                            )}
                          </th>
                          <td
                            role="cell"
                            aria-colindex={2}
                            className={styles.statusCell}
                          >
                            <span
                              className={`${styles.statusBadge} ${
                                reservation.claimedAt
                                  ? styles.statusClaimed
                                  : styles.statusUnclaimed
                              }`}
                            >
                              {reservation.claimedAt
                                ? copy.staff.claimed
                                : copy.staff.unclaimed}
                            </span>
                          </td>
                          {canViewMemberDetails && (
                            <td
                              role="cell"
                              aria-colindex={3}
                              className={`${styles.emailCell}${
                                reservation.email
                                  ? ""
                                  : ` ${styles.emailCellEmpty}`
                              }`}
                            >
                              {reservation.email ? (
                                <span
                                  className={styles.emailText}
                                  title={reservation.email}
                                >
                                  {reservation.email}
                                </span>
                              ) : (
                                <span className={styles.emailMissing}>—</span>
                              )}
                            </td>
                          )}
                          <td
                            role="cell"
                            aria-colindex={generatedColumnIndex}
                            className={styles.generatedCell}
                          >
                            <time dateTime={reservation.createdAt}>
                              <span className={styles.generatedDateTime}>
                                {formatDateTime(
                                  reservation.createdAt,
                                  gymTimezone
                                )}
                              </span>
                              <span className={styles.generatedDate}>
                                {formatDate(reservation.createdAt, gymTimezone)}
                              </span>
                            </time>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <div className={styles.tableFooter}>
                  <p
                    className={`text-body-small ${styles.tableSummary}`}
                    aria-live="polite"
                  >
                    {copy.staff.memberNumberPageSummary(
                      memberNumberRangeStart,
                      memberNumberRangeEnd,
                      memberNumberTotalCount
                    )}
                  </p>
                  <nav
                    className={styles.pageControls}
                    aria-label={copy.staff.memberNumberPaginationLabel}
                  >
                    {hasPreviousMemberNumberPage ? (
                      <Link
                        href={memberNumberPageHref(
                          memberNumberPage - 1,
                          memberNumberSearchQuery
                        )}
                        scroll={false}
                        prefetch={false}
                        className={styles.pageButton}
                        rel="prev"
                      >
                        <PageArrow direction="previous" />
                        {copy.staff.previousPage}
                      </Link>
                    ) : (
                      <span
                        className={`${styles.pageButton} ${styles.pageButtonDisabled}`}
                        aria-disabled="true"
                      >
                        <PageArrow direction="previous" />
                        {copy.staff.previousPage}
                      </span>
                    )}
                    {hasNextMemberNumberPage ? (
                      <Link
                        href={memberNumberPageHref(
                          memberNumberPage + 1,
                          memberNumberSearchQuery
                        )}
                        scroll={false}
                        prefetch={false}
                        className={styles.pageButton}
                        rel="next"
                      >
                        {copy.staff.nextPage}
                        <PageArrow direction="next" />
                      </Link>
                    ) : (
                      <span
                        className={`${styles.pageButton} ${styles.pageButtonDisabled}`}
                        aria-disabled="true"
                      >
                        {copy.staff.nextPage}
                        <PageArrow direction="next" />
                      </span>
                    )}
                  </nav>
                </div>
              </>
            )}
          </div>
        </section>

      </main>

      <dialog
        ref={memberDialogRef}
        className={styles.memberDialog}
        aria-labelledby="member-details-title"
        onClose={closeMemberDetails}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeMemberDetails();
          }
        }}
      >
        <div className={styles.memberDialogContent}>
          <div className={styles.memberDialogHeader}>
            <div className={styles.memberDialogIdentity}>
              <span className={styles.memberDialogAvatar} aria-hidden="true">
                {memberAvatarInitial}
              </span>
              <div className={styles.memberDialogHeading}>
                <p className={styles.memberDialogEyebrow}>
                  {copy.staff.memberDetailsEyebrow}
                </p>
                <h2
                  id="member-details-title"
                  className={`text-title-large ${styles.memberDialogName}`}
                >
                  {memberProfile?.name ?? copy.staff.memberDetailsTitle}
                </h2>
                <div className={styles.memberDialogMeta}>
                  {selectedMemberNumber && (
                    <span className={styles.memberDialogNumber}>
                      #{selectedMemberNumber}
                    </span>
                  )}
                  {memberProfile && (
                    <span
                      className={`${styles.memberStatusBadge} ${
                        MEMBER_STATUS_CLASS[memberProfile.status]
                      }`}
                    >
                      {copy.dashboard.status[memberProfile.status]}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.memberDialogClose}
              aria-label={copy.staff.memberDetailsClose}
              onClick={closeMemberDetails}
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
          </div>

          <div
            className={styles.memberDialogBody}
            aria-busy={memberProfileLoading}
          >
            {memberProfileState.status === "error" && !memberProfilePending && (
              <div className={styles.memberDialogErrorBlock}>
                <p role="alert" className={styles.memberDialogError}>
                  {memberProfileState.error}
                </p>
                {selectedMemberNumber && (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => loadMemberDetails(selectedMemberNumber)}
                  >
                    {copy.staff.memberDetailsRetry}
                  </button>
                )}
              </div>
            )}

            {memberProfileLoading && (
              <>
                <p role="status" className={styles.memberDialogLoading}>
                  {copy.staff.memberDetailsLoading}
                </p>
                <div className={styles.memberSkeleton} aria-hidden="true">
                  <span className={styles.memberSkeletonLine} />
                  <span className={styles.memberSkeletonLine} />
                  <div className={styles.memberSkeletonTiles}>
                    <span className={styles.memberSkeletonTile} />
                    <span className={styles.memberSkeletonTile} />
                  </div>
                  <span className={styles.memberSkeletonLine} />
                </div>
              </>
            )}

            {memberProfile && (
              <>
                <section
                  className={styles.memberModalSection}
                  aria-labelledby="member-details-membership"
                >
                  <h3
                    id="member-details-membership"
                    className={styles.memberModalSectionTitle}
                  >
                    {copy.staff.memberDetailsMembership}
                  </h3>
                  <dl className={styles.memberModalGrid}>
                    <div className={styles.memberModalWide}>
                      <dt>{copy.staff.memberDetailsPlan}</dt>
                      <dd>
                        {memberProfile.lastPayment && memberProfilePaidPlanTerms ? (
                          <>
                            <span className={styles.memberPlanTier}>
                              {MEMBER_TIER_LABEL[memberProfile.lastPayment.tier]}
                            </span>
                            <span className={styles.memberPlanTerms}>
                              {memberProfilePaidPlanTerms}
                            </span>
                          </>
                        ) : (
                          <span className={styles.memberPlanUnpaid}>
                            {copy.staff.memberDetailsNoPlanPaid}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{copy.staff.memberDetailsExpires}</dt>
                      <dd>{memberProfileExpires}</dd>
                    </div>
                    <div>
                      <dt>{copy.staff.memberDetailsRegistered}</dt>
                      <dd>{memberProfileRegistered}</dd>
                    </div>
                  </dl>
                </section>

                <section
                  className={styles.memberModalSection}
                  aria-labelledby="member-details-activity"
                >
                  <h3
                    id="member-details-activity"
                    className={styles.memberModalSectionTitle}
                  >
                    {copy.staff.memberDetailsActivity}
                  </h3>
                  <dl className={styles.memberModalGrid}>
                    <div className={styles.memberStat}>
                      <dt>{copy.staff.memberDetailsTotalCheckIns}</dt>
                      <dd className={styles.memberStatValue}>
                        {memberProfile.checkInsTotal}
                      </dd>
                    </div>
                    <div className={styles.memberStat}>
                      <dt>{copy.staff.memberDetailsThisMonth}</dt>
                      <dd className={styles.memberStatValue}>
                        {memberProfile.checkInsThisMonth}
                      </dd>
                    </div>
                    <div className={styles.memberModalWide}>
                      <dt>{copy.staff.memberDetailsLastCheckIn}</dt>
                      <dd>{memberProfileLastCheckIn}</dd>
                    </div>
                  </dl>
                </section>

                <section
                  className={styles.memberModalSection}
                  aria-labelledby="member-details-contact"
                >
                  <h3
                    id="member-details-contact"
                    className={styles.memberModalSectionTitle}
                  >
                    {copy.staff.memberDetailsContact}
                  </h3>
                  <dl className={styles.memberModalGrid}>
                    <div>
                      <dt>{copy.staff.memberDetailsEmail}</dt>
                      <dd>
                        {memberProfile.email ??
                          copy.staff.memberDetailsNotProvided}
                      </dd>
                    </div>
                    <div>
                      <dt>{copy.staff.memberDetailsPhone}</dt>
                      <dd>
                        {memberProfile.phone ??
                          copy.staff.memberDetailsNotProvided}
                      </dd>
                    </div>
                  </dl>
                </section>
              </>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
