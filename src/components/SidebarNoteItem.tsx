import { useEffect, useState } from "react";
import styles from '../styles/SidebarNoteItem.module.scss'

interface SidebarNoteItemProps {
    note: {
        id: string;
        title: string;
        date: string;
        isProcessing?: boolean;
        streamingContent?: string;
    }
}

const SidebarNoteItem = ({ note }: SidebarNoteItemProps) => {
    const [displayText, setDisplayText] = useState<string | undefined>("")
    const [showCursor, setShowCursor] = useState(true)

    useEffect(() => {
        if (!note.isProcessing || !note.streamingContent) {
            setDisplayText(note.title)
            return;
        }
        let i = 0
        const timer = setInterval(() => {
            if (i <= (note.streamingContent?.length ?? 0)) {
                setDisplayText(note.streamingContent?.slice(0, i))
                i++
            } else {
                clearInterval(timer)
            }
        }, 30)
        return () => clearInterval(timer)
    }, [note.streamingContent, note.isProcessing])

    useEffect(() => {
        const blink = setInterval(() => setShowCursor((v) => !v), 530)
        return () => clearInterval(blink)
    }, [])

    return (
        <>
            <span className={styles.noteTitle}>
                {displayText}
                {note.isProcessing && showCursor && <span className={styles.cursor}>|</span>}
            </span>
        </>
    )
}

export default SidebarNoteItem;