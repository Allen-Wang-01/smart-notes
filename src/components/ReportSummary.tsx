import { useEffect, useState } from "react";
import styles from '../styles/ReportSummary.module.scss'

const ReportSummary = ({ sentences, streamUrl, reportId }: {
    sentences?: string[];
    streamUrl?: string;
    reportId?: string;
}) => {
    const [displayed, setDisplayed] = useState<string[]>([])

    useEffect(() => {
        if (!streamUrl || !reportId) return
        const evtSource = new EventSource(streamUrl)
        evtSource.onmessage = (e) => {
            const data = JSON.parse(e.data)
            if (data.type === 'chunk') {
                setDisplayed(prev => {
                    const last = prev[prev.length - 1] || ''
                    const updated = [...prev.slice(0, -1), last + data.content]
                    return updated
                })
            }
            if (data.type === 'done') {
                evtSource.close()
            }
        }

        return () => evtSource.close()
    }, [streamUrl, reportId])

    const content = sentences || displayed

    return (
        <div className={styles.summary}>
            {content.map((sentence, i) => (
                <p key={i} className={styles.sentence}>{sentence}</p>
            ))}
        </div>
    )
}

export default ReportSummary;