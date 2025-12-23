import styles from '../styles/ReportStats.module.scss'

const ReportStats = ({ stats }: { stats: any }) => {
    return (
        <>
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <h3>{stats.noteCount}</h3>
                    <p>Notes Written</p>
                </div>
                <div className={styles.statCard}>
                    <h3>{stats.activeDays}</h3>
                    <p>Active Days</p>
                </div>
            </div>
            <div className={styles.keywordHighlight}>
                <div className={styles.keywordLabel}>Top Focus</div>
                <div className={styles.keywordValue}>
                    {stats.topKeywords[0]?.keyword || '—'}
                </div>
            </div>
        </>

    );
}

export default ReportStats;