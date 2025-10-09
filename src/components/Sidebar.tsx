import { useContext } from "react";
import NoteContext from "../context/NoteContext";
import styles from "../styles/Sidebar.module.scss";
import { useNavigate } from "react-router-dom";

interface SidebarProps {
    onNewNote: () => void;
    onSelectNote: (id: string) => void;
    closeSidebar?: () => void;
}

const Sidebar = ({ onNewNote, onSelectNote, closeSidebar }: SidebarProps) => {
    const noteContext = useContext(NoteContext);
    const navigate = useNavigate();
    if (!noteContext) return null;
    const { state } = noteContext;

    const groupedNotes = state.notes.reduce((acc, note) => {
        const date = new Date(note.date).toLocaleDateString();
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(note);
        return acc;
    }, {} as Record<string, typeof state.notes>);

    const sortedDates = Object.keys(groupedNotes).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    const handleNoteSelect = (id: string) => {
        onSelectNote(id)
        if (closeSidebar) closeSidebar() //close the sidebar after selected
    }

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <h2>Notes</h2>
                <button
                    className={styles.summaryButton}
                    onClick={
                        () => {
                            navigate("/review")
                            if (closeSidebar) closeSidebar()
                        }}
                >
                    Review
                </button>
                <button className={styles.newNoteButton} onClick={() => {
                    onNewNote()
                    if (closeSidebar) closeSidebar()
                }}
                    aria-label="Create new note"
                >
                    + New Note
                </button>
            </div>
            <div className={styles.noteGroups}>
                {sortedDates.length === 0 ? (
                    <p className={styles.empty}>No History</p>
                ) : (
                    sortedDates.map((date) => (
                        <div key={date} className={styles.dateGroup}>
                            <h3 className={styles.dateTitle}>{date}</h3>
                            <ul className={styles.noteList}>
                                {groupedNotes[date].map((note) => (
                                    <li
                                        key={note.id}
                                        className={styles.noteItem}
                                        onClick={() => onSelectNote(note.id)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                handleNoteSelect(note.id)
                                            }
                                        }}
                                        aria-label={`Select note: ${note.title}`}
                                    >
                                        <span className={styles.noteTitle}>{note.title}</span>
                                        <span className={styles.noteTime}>
                                            {new Date(note.date).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Sidebar;