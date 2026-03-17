import styles from '@/styles/loading.module.css';

export default function AdminLoading() {
  return (
    <div className={styles.page}>
      {/* Header skeleton */}
      <div className={styles.header}>
        <div className={styles.skeleton} style={{ width: '12rem', height: '2rem' }} />
        <div className={styles.skeleton} style={{ width: '8rem', height: '2.5rem' }} />
      </div>

      {/* Stats cards skeleton */}
      <div className={styles.statsGrid1x2x4}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.card}>
            <div className={styles.statLabel} style={{ width: '6rem' }} />
            <div className={styles.statValueLarge} style={{ width: '4rem' }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className={styles.card} style={{ padding: 0 }}>
        <div className={styles.cardHeaderBar}>
          <div className={styles.skeleton} style={{ width: '8rem', height: '1.5rem' }} />
        </div>
        <div className={styles.dividedList}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.dividedItem}>
              <div className={styles.skeletonRound} style={{ width: '2.5rem', height: '2.5rem' }} />
              <div className={`${styles.flex1} ${styles.spacedColumn}`}>
                <div className={styles.skeleton} style={{ width: '12rem', height: '1rem' }} />
                <div className={styles.skeleton} style={{ width: '8rem', height: '0.75rem' }} />
              </div>
              <div className={styles.skeleton} style={{ width: '5rem', height: '2rem' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
