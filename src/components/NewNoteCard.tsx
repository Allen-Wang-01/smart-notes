import { useState } from "react";
import toast from "react-hot-toast";
import styles from '../styles/NewNoteCard.module.scss'
import { useCreateNoteMutation } from "../hooks/useCreateNoteMutation";
import TextareaAutosize from "react-textarea-autosize";

const NOTE_TYPES = [
    { value: "authored", label: "Authored", hint: "Your own writing" },
    { value: "saved", label: "Saved", hint: "Captured from elsewhere" },
] as const;

type NoteType = (typeof NOTE_TYPES)[number]["value"];

// Platform detection for the keyboard shortcut hint.
// `navigator.platform` is deprecated but still the most reliable signal across
// browsers; falling back to `userAgent` for safety.
const isMacLike = (() => {
    if (typeof navigator === "undefined") return false;
    const platform = navigator.platform || navigator.userAgent || "";
    return /Mac|iPhone|iPad|iPod/i.test(platform);
})();

const MOD_KEY_LABEL = isMacLike ? "⌘" : "Ctrl";


const NewNoteCard = () => {
    const [content, setContent] = useState("")
    const [description, setDescription] = useState("");
    const [sourceType, setSourceType] = useState<NoteType>("authored");
    const mutation = useCreateNoteMutation()

    const isBusy = mutation.isPending;
    const canSubmit = content.trim().length > 0 && !isBusy;

    const handleSubmit = async () => {
        if (!content.trim()) {
            toast.error("Please enter the note content")
            return;
        }
        mutation.mutate(
            {
                rawContent: content.trim(),
                description: description.trim(),
                sourceType,
            },
            {
                onSettled: () => {
                    setContent("");
                    setDescription("");
                },
            }
        )
    }

    // Cmd/Ctrl + Enter to submit, plain Enter for newlines.
    // (The original component bound this to the button, where it didn't fire
    // unless the button was already focused — this is the fix.)
    const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isMod = e.metaKey || e.ctrlKey;
        if (e.key === "Enter" && isMod && canSubmit) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Index of the active type — drives the segmented-control slider.
    const activeIndex = NOTE_TYPES.findIndex((t) => t.value === sourceType);

    return (
        <div className={styles.card}>
            {/* Type selector — segmented control */}
            <div
                className={styles.segmented}
                role="radiogroup"
                aria-label="Note type"
            >
                <span
                    className={styles.segmentedSlider}
                    style={{
                        transform: `translateX(${activeIndex * 100}%)`,
                    }}
                    aria-hidden="true"
                />
                {NOTE_TYPES.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={sourceType === opt.value}
                        className={`${styles.segment} ${sourceType === opt.value ? styles.segmentActive : ""
                            }`}
                        onClick={() => setSourceType(opt.value)}
                        disabled={isBusy}
                        title={opt.hint}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Main content textarea */}
            <TextareaAutosize
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Capture a thought..."
                minRows={4}
                maxRows={12}
                className={styles.textarea}
                disabled={isBusy}
            />

            {/* Description field — persistent, slightly recessed visual weight */}
            <div className={styles.descriptionWrap}>
                <label htmlFor="note-description" className={styles.descriptionLabel}>
                    Description
                    <span className={styles.descriptionHint}>optional, but helpful later</span>
                </label>
                <input
                    id="note-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A short note about this note..."
                    className={styles.descriptionInput}
                    disabled={isBusy}
                    maxLength={140}
                />
            </div>

            {/* Footer — hint + submit */}
            <div className={styles.footer}>
                <span className={styles.shortcutHint} aria-hidden="true">
                    <kbd className={styles.kbd}>{MOD_KEY_LABEL}</kbd>
                    <kbd className={styles.kbd}>↵</kbd>
                    <span>to send</span>
                </span>

                <button
                    type="button"
                    onClick={handleSubmit}
                    className={styles.sendButton}
                    disabled={!canSubmit}
                    aria-label="Send note"
                >
                    <span className={styles.sendButtonLabel}>
                        {isBusy ? "Sending" : "Send"}
                    </span>
                    <span className={styles.sendButtonIcon}>
                        {isBusy ? <SpinnerIcon /> : <ArrowIcon />}
                    </span>
                </button>
            </div>
        </div>
    );
};

// ---- Icons ------------------------------------------------------------------
const SpinnerIcon = () => (
    <svg
        className={styles.spinner}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden="true"
    >
        <path
            d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8z"
            opacity=".3"
            fill="currentColor"
        />
        <path
            d="M12 22c5.52 0 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8V2C6.48 2 2 6.48 2 12s4.48 10 10 10z"
            fill="currentColor"
        />
    </svg>
);

// Slim arrow — clean and modern, suggests forward motion without feeling clinical
const ArrowIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M3 8h10" />
        <path d="M9 4l4 4-4 4" />
    </svg>
);

export default NewNoteCard;