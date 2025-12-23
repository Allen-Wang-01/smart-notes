import styles from '../styles/ReportSummary.module.scss'

const ReportSummary = ({ sentences }: {
    sentences?: string[];
}) => {
    return (
        <div className={styles.summary}>
            {sentences?.map((sentence, i) => (
                <p key={i} className={styles.sentence}>{sentence}</p>
            ))}
        </div>
    )
}

export default ReportSummary;