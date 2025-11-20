import styles from '../styles/ReportHeader.module.scss'



const ReportHeader = ({ type, period }: { type: string; period: string }) => {
    const formatPeriod = (periodKey: string) => {
        if (periodKey.includes('-W')) {
            const week = periodKey.split('-W')[1]
            return `Week ${week}`
        }
        return periodKey.replace('-M', '/').replace(/(\d{4})\/(\d{2})/, '$1 — $2')
    }

    return (
        <header className={styles.header}>
            <h1>Your {type === 'weekly' ? 'Weekly' : 'Monthly'} Reflection</h1>
            <p className={styles.period}>{formatPeriod(period)}</p>
            <div className={styles.divider} />
        </header>
    );

}

export default ReportHeader;