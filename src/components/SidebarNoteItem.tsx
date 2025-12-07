import styles from '../styles/SidebarNoteItem.module.scss'

interface SidebarNoteItemProps {
    note: {
        id: string;
        title: string;
        date: string;
        status: "pending" | "processing" | "retrying" | "completed" | "failed";
    }
}

const SidebarNoteItem = ({ note }: SidebarNoteItemProps) => {
    const isProcessing = ["pending", "processing", "retrying"].includes(note.status);
    const displayTitle = isProcessing
        ? 'Processing...'
        : note.title || 'Untitled'

    return (
        <div className={styles.noteItem}>
            <span className={styles.noteTitle}>
                {displayTitle}
            </span>
            <span className={styles.noteDate}>
                {new Date(note.date).toLocaleDateString()}
            </span>
        </div>
    )
}

export default SidebarNoteItem;