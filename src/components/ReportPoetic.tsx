import styles from '../styles/ReportPoetic.module.scss'

const ReportPoetic = ({ line }: { line: string }) => {
    if (!line) return null;

    return (
        <div className={styles.poetic}>
            <p>“{line}”</p>
        </div>
    )
}

export default ReportPoetic;