import styles from '@/styles/loading.module.css';

export default function DashboardLoading() {
  return (
    <div className={styles.page}>
      {/* Top bar skeleton */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.skeletonRound} style={{ width: '3rem', height: '3rem' }} />
          <div className={styles.spacedColumn}>
            <div className={styles.skeleton} style={{ width: '8rem', height: '1.25rem' }} />
            <div className={styles.skeleton} style={{ width: '6rem', height: '1rem' }} />
          </div>
        </div>
        <div className={styles.skeletonAccent} style={{ width: '7rem', height: '2.5rem', borderRadius: 'var(--radius-lg, 8px)' }} />
      </div>

      {/* Stats row */}
      <div className={styles.statsGrid2x4}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.card}>
            <div className={styles.statLabel} />
            <div className={styles.statValue} />
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className={styles.contentGrid1x3}>
        {/* Large panel */}
        <div className={styles.card}>
          <div className={styles.spacedColumn1}>
            <div className={styles.skeleton} style={{ width: '10rem', height: '1.5rem' }} />
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.rowItem}>
                <div className={styles.skeleton} style={{ width: '2rem', height: '2rem' }} />
                <div className={styles.flex1}>
                  <div className={styles.spacedColumnSm}>
                    <div className={styles.skeleton} style={{ width: '12rem', height: '1rem' }} />
                    <div className={styles.skeleton} style={{ width: '8rem', height: '0.75rem' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side panels */}
        <div className={styles.spacedColumn1}>
          {[1, 2].map((i) => (
            <div key={i} className={styles.card}>
              <div className={styles.skeleton} style={{ width: '7rem', height: '1.25rem', marginBottom: '0.75rem' }} />
              <div className={styles.spacedColumn}>
                {[1, 2, 3].map((j) => (
                  <div key={j} className={styles.skeleton} style={{ width: '100%', height: '1rem' }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
