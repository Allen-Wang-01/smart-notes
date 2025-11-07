import { useEffect, useState } from "react";
import styles from '../styles/SidebarNoteItem.module.scss'

interface SidebarNoteItemProps {
    note: {
        id: string;
        title: string;
        date: string;
        isProcessing?: boolean;
    }
}

const SidebarNoteItem = ({ note }: SidebarNoteItemProps) => {
    const [showCursor, setShowCursor] = useState(false)

    //display flashing cursor only when processing
    useEffect(() => {
        if (!note.isProcessing) return
        const blink = setInterval(() => setShowCursor((v) => !v), 530)
        return () => clearInterval(blink)
    }, [note.isProcessing])

    const displayTitle = note.isProcessing
        ? 'Processing...'
        : note.title || 'Untitled'

    return (
        <div className={styles.noteItem}>
            <span className={styles.noteTitle}>
                {displayTitle}
                note.isProcessing && showCursor && <span className={styles.cursor}>|</span>
            </span>
            <span className={styles.noteDate}>
                {new Date(note.date).toLocaleDateString()}
            </span>
        </div>
    )
}

export default SidebarNoteItem;