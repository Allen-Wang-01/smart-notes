import styles from '../styles/ReportStats.module.scss'

const ReportStats = ({ stats }: { stats: any }) => {
    return (
        <div className={styles.statsGrid}>
            <div className={styles.statCard}>
                <h3>{stats.noteCount}</h3>
                <p>Notes Written</p>
            </div>
            <div className={styles.statCard}>
                <h3>{stats.activeDays}</h3>
                <p>Active Days</p>
            </div>
            <div className={styles.statCard}>
                <h3>{stats.topKeywords[0]?.keyword || '—'}</h3>
                <p>Top Focus</p>
            </div>
        </div>
    );
}

export default ReportStats;