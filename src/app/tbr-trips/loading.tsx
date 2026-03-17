import styles from '@/styles/loading.module.css';

export default function TbrTripsLoading() {
  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeftStacked}>
          <div className={styles.skeleton} style={{ width: '12rem', height: '2rem' }} />
          <div className={styles.skeleton} style={{ width: '16rem', height: '1rem' }} />
        </div>
        <div className={styles.headerRight}>
          <div className={styles.skeleton} style={{ width: '7rem', height: '2.5rem' }} />
          <div className={styles.skeletonAccent} style={{ width: '7rem', height: '2.5rem' }} />
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid2x4}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.card}>
            <div className={styles.statLabel} />
            <div className={styles.statValue} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filtersRow}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeleton} style={{ width: '8rem', height: '2.5rem' }} />
        ))}
        <div className={styles.skeleton} style={{ width: '12rem', height: '2.5rem' }} />
      </div>

      {/* Trip list */}
      <div className={styles.card} style={{ padding: 0 }}>
        <div className={styles.dividedList}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.dividedItem}>
              <div className={styles.flexShrink0}>
                <div className={styles.skeleton} style={{ width: '2.5rem', height: '2.5rem' }} />
              </div>
              <div className={`${styles.flex1} ${styles.spacedColumn}`}>
                <div className={styles.row}>
                  <div className={styles.skeleton} style={{ width: '6rem', height: '1.25rem' }} />
                  <div className={styles.skeletonAccentRound} style={{ width: '4rem', height: '1.25rem' }} />
                </div>
                <div className={styles.skeleton} style={{ width: '16rem', height: '1rem' }} />
                <div className={styles.skeleton} style={{ width: '12rem', height: '1rem' }} />
              </div>
              <div className={`${styles.flexShrink0} ${styles.spacedColumnSm} ${styles.textRight}`}>
                <div className={styles.skeleton} style={{ width: '5rem', height: '1rem', marginLeft: 'auto' }} />
                <div className={styles.skeleton} style={{ width: '4rem', height: '1rem', marginLeft: 'auto' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
