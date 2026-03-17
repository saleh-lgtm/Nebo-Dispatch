import styles from '@/styles/loading.module.css';

export default function AccountingLoading() {
  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.skeleton} style={{ width: '10rem', height: '2rem' }} />
        <div className={styles.headerRight}>
          <div className={styles.skeleton} style={{ width: '6rem', height: '2.5rem' }} />
          <div className={styles.skeleton} style={{ width: '8rem', height: '2.5rem' }} />
        </div>
      </div>

      {/* Summary cards */}
      <div className={styles.statsGrid1x3}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.cardP5}>
            <div className={styles.summaryHeader}>
              <div className={styles.skeleton} style={{ width: '7rem', height: '1rem' }} />
              <div className={styles.skeleton} style={{ width: '1.5rem', height: '1.5rem' }} />
            </div>
            <div className={styles.statValueLarge} />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className={styles.card} style={{ padding: 0 }}>
        <div className={styles.cardHeaderBar}>
          <div className={styles.skeleton} style={{ width: '9rem', height: '1.5rem' }} />
          <div className={styles.skeleton} style={{ width: '12rem', height: '2rem' }} />
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHead}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <th key={i} className={styles.tableTh}>
                    <div className={styles.skeleton} style={{ width: '5rem', height: '1rem' }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row} className={styles.tableRow}>
                  {[1, 2, 3, 4, 5].map((col) => (
                    <td key={col} className={styles.tableTd}>
                      <div className={styles.skeleton} style={{ width: '6rem', height: '1rem' }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
