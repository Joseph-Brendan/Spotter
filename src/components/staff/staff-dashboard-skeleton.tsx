import { copy } from "@/lib/copy";
import styles from "@/app/staff/staff.module.css";

export default function StaffDashboardSkeleton() {
  return (
    <div className={styles.dashboardPage} aria-busy="true">
      <p role="status" className={styles.visuallyHidden}>
        {copy.staff.loadingDashboard}
      </p>

      <header className={styles.appBar}>
        <div className={styles.appBarInner}>
          <span className={`${styles.brand} text-label-large`}>SPOTTER</span>
          <span className={styles.skeletonAvatar} aria-hidden="true" />
        </div>
      </header>

      <main className={styles.main}>
        <header className={styles.pageHeader}>
          <div className={styles.pageHeading}>
            <span
              className={`${styles.skeletonBar} ${styles.skeletonTitle}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.skeletonBar} ${styles.skeletonSubtitle}`}
              aria-hidden="true"
            />
          </div>
        </header>

        <section className={styles.panel} aria-hidden="true">
          <div className={styles.panelHeader}>
            <span
              className={`${styles.skeletonBar} ${styles.skeletonHeading}`}
            />
          </div>
          <div className={styles.panelBody}>
            <div className={styles.reserveRow}>
              <span className={styles.skeletonField} />
              <span className={styles.skeletonButton} />
            </div>
          </div>
          <div className={styles.numberHistory}>
            <span
              className={`${styles.skeletonBar} ${styles.skeletonHeading}`}
            />
            {[0, 1, 2, 3, 4].map((row) => (
              <span key={row} className={styles.skeletonRow} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
