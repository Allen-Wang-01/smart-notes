import { useContext } from "react";
import NoteContext from "../context/NoteContext";
import NoteEditor from "./NoteEditor";
import NewNoteCard from "./NewNoteCard";
import styles from "../styles/MainContent.module.scss";

interface MainContentProps {
    selectedNoteId: string | null;
    onNoteAdded: (noteId: string) => void;
}

const MainContent = ({ selectedNoteId, onNoteAdded }: MainContentProps) => {
    const noteContext = useContext(NoteContext)
    if (!noteContext) return null
    const { state, dispatch } = noteContext
    const selectedNote = state.notes.find((note) => note.id === selectedNoteId)

    return (
        <div className={styles.mainContent}>
            {selectedNote ? (
                <NoteEditor note={selectedNote} />
            ) : (
                <div className={styles.newNoteContainer}>
                    <NewNoteCard dispatch={dispatch} onNoteAdded={onNoteAdded} />
                </div>
            )}
        </div>
    )
}

export default MainContent;