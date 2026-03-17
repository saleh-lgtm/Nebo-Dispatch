import styles from '@/styles/loading.module.css';

export default function RootLoading() {
  return (
    <div className={styles.rootContainer}>
      <div className={styles.rootInner}>
        <div className={styles.spinner} />
        <p className={styles.spinnerText}>Loading...</p>
      </div>
    </div>
  );
}
