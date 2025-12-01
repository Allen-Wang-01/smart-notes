import { useState } from "react";
import toast from "react-hot-toast";
import styles from '../styles/NewNoteCard.module.scss'
import { useCreateNoteMutation } from "../hooks/useCreateNoteMutation";
import TextareaAutosize from "react-textarea-autosize";

const NewNoteCard = () => {
    const [content, setContent] = useState("")
    const [category, setCategory] = useState<"meeting" | "study" | "interview">("meeting");
    const mutation = useCreateNoteMutation()

    const handleSubmit = async () => {
        if (!content.trim()) {
            toast.error("Please enter the note content")
            return;
        }
        mutation.mutate(
            {
                rawContent: content.trim(),
                category,
            },
            {
                onSettled: () => {
                    setContent("");
                },
            }
        )
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && content.trim() && !mutation.isPending) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div className={styles.newNoteCard}>
            <TextareaAutosize
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Please enter the content..."
                minRows={3}
                maxRows={10}
                className={styles.textarea}
                disabled={mutation.isPending}
            />
            <div className={styles.container}>
                <div className={styles.categoryButtons}>
                    {["meeting", "study", "interview"].map((cat) => (
                        <button
                            key={cat}
                            className={`${styles.categoryButton} ${category === cat ? styles.active : ""}`}
                            onClick={() =>
                                setCategory(cat as "meeting" | "study" | "interview")
                            }
                            disabled={mutation.isPending}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <button onClick={handleSubmit} className={styles.sendButton}
                    onKeyDown={handleKeyDown} disabled={mutation.isPending}>
                    {mutation.isPending ? (
                        <svg
                            className={styles.spinner}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                        >
                            <path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8z" opacity=".3" />
                            <path d="M12 22c5.52 0 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8V2C6.48 2 2 6.48 2 12s4.48 10 10 10z" />
                        </svg>
                    ) : (
                        <svg
                            className={styles.arrowIcon}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            width="20"
                            height="20"
                        >
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    )
}

export default NewNoteCard;