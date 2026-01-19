import Modal from "react-modal";
import styles from "../styles/OriginalNoteModal.module.scss";

export interface OriginalNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    rawContent: string;
    createdAt?: string | Date;
    category?: string;
}

export default function OriginalNoteModal({
    isOpen,
    onClose,
    rawContent,
    category,
}: OriginalNoteModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            overlayClassName={styles.overlay}
            className={styles.content}
            contentLabel="Original Note"
            shouldCloseOnOverlayClick
        >
            <header className={styles.header}>
                <h2>Original Note</h2>
                <button
                    className={styles.close}
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    ✕
                </button>
            </header>

            {category && (
                <div className={styles.meta}>
                    {category && <span>{category}</span>}
                </div>
            )}

            <pre className={styles.body}>{rawContent}</pre>
        </Modal>
    );
}
