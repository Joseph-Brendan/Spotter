"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDeleteAccount, type SessionMember } from "@/hooks/use-auth";
import { copy } from "@/lib/copy";
import styles from "@/app/page.module.css";

interface MemberAccountMenuProps {
  member: SessionMember;
  onSignOut: () => void;
  signingOut: boolean;
}

function initialsFor(member: SessionMember): string {
  const words = member.name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return member.email.charAt(0).toUpperCase();
  }

  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";

  return `${first}${last}`.toUpperCase();
}

export default function MemberAccountMenu({
  member,
  onSignOut,
  signingOut,
}: MemberAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const deleteAccount = useDeleteAccount();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        avatarButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closeDelete = () => {
    setDeleteOpen(false);
    setDeletePassword("");
    setDeleteError("");
  };

  const handleDeleteAccount = (e: React.FormEvent) => {
    e.preventDefault();

    if (deleteAccount.isPending || deletePassword.length === 0) {
      return;
    }

    setDeleteError("");

    deleteAccount.mutate(deletePassword.trim(), {
      onError: (error) =>
        setDeleteError(error.message || copy.deletion.passwordWrong),
    });
  };

  return (
    <div className={styles.memberAccountMenu} ref={menuRef}>
      <button
        ref={avatarButtonRef}
        type="button"
        className={styles.memberAvatarButton}
        aria-expanded={open}
        aria-controls="member-account-panel"
        aria-label={`${copy.dashboard.account}, ${member.name}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">{initialsFor(member)}</span>
      </button>

      <div
        id="member-account-panel"
        className={styles.memberAccountPanel}
        hidden={!open}
      >
        <p className={styles.memberAccountIdentity}>
          <span className={styles.memberAccountName}>{member.name}</span>
          <span className={styles.memberAccountEmail}>{member.email}</span>
        </p>

        <div className={styles.memberAccountLinks}>
          <Link href="/auth?view=reset" className={styles.linkReset}>
            {copy.dashboard.managePassword}
          </Link>
        </div>

        <div className={styles.deleteSection}>
          {deleteOpen ? (
            <form onSubmit={handleDeleteAccount} className={styles.deleteForm}>
              <span className={`text-body-small ${styles.askSubtitle}`}>
                {copy.deletion.warning}
              </span>
              <div className={styles.deleteActions}>
                <div className={styles.verifyField}>
                  <label
                    htmlFor="delete-account-password"
                    className={`text-label-small ${styles.verifyLabel}`}
                  >
                    {copy.deletion.confirmPrompt}
                  </label>
                  <input
                    id="delete-account-password"
                    type="password"
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    aria-invalid={deleteError ? true : undefined}
                    aria-describedby={
                      deleteError ? "delete-account-error" : undefined
                    }
                    className={`text-body-medium ${styles.verifyInput}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={
                    deleteAccount.isPending || deletePassword.length === 0
                  }
                  className={`text-label-medium ${styles.deleteConfirmButton}`}
                >
                  {deleteAccount.isPending
                    ? copy.deletion.deleting
                    : copy.deletion.confirmButton}
                </button>
                <button
                  type="button"
                  disabled={deleteAccount.isPending}
                  onClick={closeDelete}
                  className={`text-label-medium ${styles.verifyResendButton}`}
                >
                  {copy.deletion.cancelButton}
                </button>
              </div>
              {deleteError && (
                <span
                  id="delete-account-error"
                  role="alert"
                  className={`text-body-small ${styles.verifyError}`}
                >
                  {deleteError}
                </span>
              )}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className={`text-label-medium ${styles.deleteLink}`}
            >
              {copy.deletion.openButton}
            </button>
          )}
        </div>

        <div className={styles.memberAccountSignOut}>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className={styles.memberSignOutButton}
          >
            {copy.dashboard.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}
