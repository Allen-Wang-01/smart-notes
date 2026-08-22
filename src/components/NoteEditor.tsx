import toast from "react-hot-toast";
import { useState, useEffect, useMemo } from "react";
import styles from '../styles/NoteEditor.module.scss'
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";


// ---- Types -----------------------------------------------------------------
export type NoteType = "authored" | "saved";

export interface Note {
    id: string;
    title: string;
    content: string;
    rawContent: string;
    created: string;
    updated: string;
    status: "pending" | "processing" | "retrying" | "completed" | "failed";
    sourceType: NoteType;
}

interface NoteEditorProps {
    note: Note;
    isStreaming: boolean;
    streamError: string | null;
}

export const MOCK_NOTE: Note = {
    id: "mock-1",
    title: "Preparing for the agent team interview",
    rawContent: `Next Tuesday I have an interview with the agent team at the company I've been wanting to join for ages. I've been reading their docs and tutorials all weekend and I keep coming back to the same anxious thought — I have zero production experience building agents.

My background is mostly traditional backend and ML infra. The closest I've gotten to "agentic" work is building a tool calling layer for an internal demo last year, which felt more like glorified function dispatch than anything resembling reasoning loops, planning, or real autonomy.

I keep telling myself I should fake it — read enough blog posts, learn the right vocabulary, sound confident enough that they don't realize I'm new to this. But that feels gross and also probably won't work. People who actually build agents will see through it in five minutes.

Notes I want to revisit before Tuesday: the design doc I wrote in January about why we picked Postgres over a vector store for the RAG prototype. The one about reliability budgets. The thing I wrote after the production incident in March. I keep skipping past these because they don't feel like agent work, but maybe that's exactly the point.`,
    content:
        "You're describing this interview prep by treating your lack of agent experience as a weakness. But the engineering decisions you recorded three months ago — starting from reliability, refusing to chase frameworks — are exactly the kind of thinking the agent team is missing.",
    created: "2026-04-28T10:30:00Z",
    updated: "2026-04-30T14:15:00Z",
    status: "completed",
    sourceType: "authored",
};

const NoteEditor = ({ note, isStreaming, streamError }: NoteEditorProps) => {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(note.title);
    const [confirmingDelete, setConfirmingDelete] = useState(false);


    // When database note updates (after refetch), sync into editor
    useEffect(() => {
        if (!isEditing) {
            setEditTitle(note.title);
        }
    }, [note.title, isEditing]);

    // Reset the inline delete confirmation if the user starts editing or
    // navigates away from that intent (e.g. clicks edit instead).
    useEffect(() => {
        if (isEditing) setConfirmingDelete(false);
    }, [isEditing]);


    //update note
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editTitle.trim()) throw new Error("Title cannot be empty")
            const res = await api.put(`/notes/${note.id}`, {
                title: editTitle.trim(),
            });
            return res.data.note;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] })
            queryClient.invalidateQueries({ queryKey: ["note", note.id] })
            toast.success("Saved successfully");
            setIsEditing(false);
        },
        onError: (err: Error) => toast.error(err.message || "Save failed"),
    })

    //delete note
    const deleteMutation = useMutation({
        mutationFn: async () => {
            await api.delete(`/notes/${note.id}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] })
            toast.success("Note deleted")
            navigate('/home')
        },
        onError: () => toast.error("Failed to delete"),
    })

    //regenerateNote 
    // const regenerateMutation = useMutation({
    //     mutationFn: () => api.post(`/notes/${note.id}/regenerate`),
    //     onSuccess: () => {
    //         toast.success("Regenerating...")
    //         // re-enter same page → shouldStream=true
    //         navigate(`/note/${note.id}`, {
    //             state: { shouldStream: true },
    //             replace: true,
    //         });
    //     },
    //     onError: () => toast.error("Failed to regenerate"),
    // })

    const disableEditing = isStreaming || updateMutation.isPending;
    const isBusy = isStreaming || updateMutation.isPending || deleteMutation.isPending;

    const createdLabel = useMemo(() => formatDate(note.created), [note.created]);
    const updatedLabel = useMemo(() => formatDate(note.updated), [note.updated]);
    const showUpdated = updatedLabel && updatedLabel !== createdLabel;

    const handleSaveTitle = () => updateMutation.mutate();
    const handleCancelEdit = () => {
        setEditTitle(note.title);
        setIsEditing(false);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (editTitle.trim()) handleSaveTitle();
        } else if (e.key === "Escape") {
            e.preventDefault();
            handleCancelEdit();
        }
    };


    return (
        <article className={`${styles.editor} ${isEditing ? styles.editorDimmed : ""}`}>
            {/* ---- Header: title + meta + actions ----------------------- */}
            <header className={styles.header}>
                {isEditing ? (
                    <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={handleTitleKeyDown}
                        placeholder="Enter the title"
                        className={styles.titleInput}
                        disabled={disableEditing}
                        autoFocus
                    />
                ) : (
                    <h1 className={styles.title}>
                        {note.title}
                        {isStreaming && <span className={styles.cursor} aria-hidden="true">|</span>}
                    </h1>
                )}

                <div className={styles.metaRow}>
                    <span className={styles.typeBadge}>
                        <span className={`${styles.typeDot} ${styles[`typeDot--${note.sourceType}`]}`} aria-hidden="true" />
                        {note.sourceType === "authored" ? "Authored" : "Saved"}
                    </span>
                    <span className={styles.metaSep} aria-hidden="true">·</span>
                    <span>Created {createdLabel}</span>
                </div>

                <div className={styles.actions}>
                    {isEditing ? (
                        <>
                            <button
                                type="button"
                                onClick={handleSaveTitle}
                                className={`${styles.actionButton} ${styles.actionPrimary}`}
                                disabled={disableEditing || !editTitle.trim()}
                            >
                                {updateMutation.isPending ? "Saving..." : "Save"}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className={styles.actionButton}
                                disabled={disableEditing}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className={styles.actionButton}
                                disabled={isBusy}
                            >
                                Edit title
                            </button>

                            {/* Regenerate is disabled in this iteration. To restore, uncomment:
                            <button
                                type="button"
                                onClick={() => regenerateMutation.mutate()}
                                className={styles.actionButton}
                                disabled={isBusy || regenerateMutation.isPending}
                            >
                                {regenerateMutation.isPending ? "Regenerating..." : "Regenerate"}
                            </button>
                            */}

                            {confirmingDelete ? (
                                <span className={styles.confirmCluster}>
                                    <span className={styles.confirmText}>Delete this note?</span>
                                    <button
                                        type="button"
                                        onClick={() => deleteMutation.mutate()}
                                        className={`${styles.actionButton} ${styles.actionDanger}`}
                                        disabled={deleteMutation.isPending}
                                    >
                                        {deleteMutation.isPending ? "Deleting..." : "Yes, delete"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmingDelete(false)}
                                        className={styles.actionButton}
                                        disabled={deleteMutation.isPending}
                                    >
                                        Cancel
                                    </button>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDelete(true)}
                                    className={styles.actionButton}
                                    disabled={isBusy}
                                >
                                    Delete
                                </button>
                            )}
                        </>
                    )}
                </div>
            </header>

            {/* ---- AI Insight (or streaming/error state) ---------------- */}
            <section className={styles.insight} aria-label="AI insight">
                <div className={styles.insightLabel}>
                    <SparkleIcon />
                    <span>AI Insight</span>
                </div>

                {streamError ? (
                    <p className={styles.insightError}>{streamError}</p>
                ) : isStreaming && !note.content ? (
                    <p className={styles.insightPending}>
                        <span className={styles.insightPulse}>Reading carefully...</span>
                    </p>
                ) : (
                    <p className={styles.insightText}>
                        {note.content}
                        {isStreaming && <span className={styles.cursor} aria-hidden="true">|</span>}
                    </p>
                )}
            </section>

            {/* ---- Original raw note ------------------------------------- */}
            <section className={styles.original} aria-label="Original note">
                <div className={styles.sectionDivider}>
                    <span className={styles.sectionLabel}>Original note</span>
                    <span className={styles.dividerLine} aria-hidden="true" />
                </div>

                <RawContentBody text={note.rawContent} />
            </section>

            {/* ---- Footer meta ------------------------------------------- */}
            <footer className={styles.footer}>
                <span>Created {createdLabel}</span>
                {showUpdated && (
                    <>
                        <span className={styles.metaSep} aria-hidden="true">·</span>
                        <span>Last updated {updatedLabel}</span>
                    </>
                )}
            </footer>
        </article>
    )
}


// ---- Helpers ----------------------------------------------------------------

// Renders raw plain-text content with paragraph breaks, drop cap on the first
// paragraph, and clickable URLs.
const RawContentBody = ({ text }: { text?: string }) => {
    const paragraphs = useMemo(() => splitParagraphs(text), [text]);

    if (paragraphs.length === 0) return null;

    return (
        <div className={styles.rawBody}>
            {paragraphs.map((para, i) => (
                <p
                    key={i}
                    className={`${styles.rawParagraph} ${i === 0 ? styles.rawFirstParagraph : ""}`}
                >
                    {linkifyText(para)}
                </p>
            ))}
        </div>
    );
};

// Split on blank lines (paragraphs) but preserve hard line breaks within a
// paragraph as-is (CSS uses white-space: pre-line on individual paragraphs).
const splitParagraphs = (text?: string): string[] => {
    if (!text) return [];
    return text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
};

// Detect URLs in plain text and turn them into anchor tags. Returns an array
// of strings and React elements that can be rendered as children.
const URL_REGEX = /\b(https?:\/\/[^\s<>]+)/g;

const linkifyText = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Reset regex state since it's defined at module scope with `g` flag.
    URL_REGEX.lastIndex = 0;

    while ((match = URL_REGEX.exec(text)) !== null) {
        const before = text.slice(lastIndex, match.index);
        if (before) parts.push(before);

        parts.push(
            <a
                key={match.index}
                href={match[0]}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.rawLink}
            >
                {match[0]}
            </a >
        );

        lastIndex = match.index + match[0].length;
    }

    const tail = text.slice(lastIndex);
    if (tail) parts.push(tail);

    return parts;
};

const formatDate = (iso: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

// ---- Icons ------------------------------------------------------------------
const SparkleIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width="11"
        height="11"
        fill="currentColor"
        aria-hidden="true"
    >
        <path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" />
    </svg>
);

export default NoteEditor;