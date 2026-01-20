import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import styles from '../styles/NoteEditor.module.scss'
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import OriginalNoteModal from "./OriginalNoteModal";

export interface Note {
    id: string;
    title: string;
    content: string;
    rawContent: string;
    created: string;
    updated: string;
    status: "pending" | "processing" | "retrying" | "completed" | "failed";
    category: "meeting" | "study" | "interview";
}

interface NoteEditorProps {
    note: Note;
    isStreaming: boolean;
    streamError: string | null;
}

const NoteEditor = ({ note, isStreaming, streamError }: NoteEditorProps) => {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(note.title);
    const [editContent, setEditContent] = useState(note.content);
    const [editCategory, setEditCategory] = useState(note.category);
    const [showOriginal, setShowOriginal] = useState(false)

    // When database note updates (after refetch), sync into editor
    useEffect(() => {
        if (!isEditing) {
            setEditTitle(note.title);
            setEditContent(note.content);
            setEditCategory(note.category);
        }
    }, [note, isEditing]);


    //update note
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editTitle.trim()) throw new Error("Title cannot be empty")
            if (!editContent.trim()) throw new Error("Content cannot be empty")
            const res = await api.put(`/notes/${note.id}`, {
                title: editTitle.trim(),
                content: editContent.trim(),
                category: editCategory,
            });
            return res.data.note;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] })
            queryClient.invalidateQueries({ queryKey: ["note", note.id] })
            toast.success("Saved successfully");
            setIsEditing(false);
        },
        onError: () => toast.error("Save failed")
    })

    //delete note
    const deleteMutation = useMutation({
        mutationFn: async () => {
            await api.delete(`/notes/${note.id}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] })
            toast.success("Note deleted")
            navigate('/')
        }
    })

    //regenerateNote 
    const regenerateMutation = useMutation({
        mutationFn: () => api.post(`/notes/${note.id}/regenerate`),
        onSuccess: () => {
            toast.success("Regenerating...")
            // re-enter same page → shouldStream=true
            navigate(`/note/${note.id}`, {
                state: { shouldStream: true },
                replace: true,
            });
        },
        onError: () => toast.error("Failed to regenerate"),
    })

    const disableEditing = isStreaming || updateMutation.isPending;
    const disableRegenerate =
        isEditing || isStreaming || regenerateMutation.isPending;

    return (
        <div className={styles.editorWrapper}>
            <div className={styles.header}>
                {isEditing ? (
                    <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Enter the title"
                        className={styles.titleInput}
                        disabled={disableEditing}
                        autoFocus
                    />
                ) : (
                    <h2>{note.title}
                        {isStreaming && <span className={styles.cursor}>|</span>}
                    </h2>
                )}
                <div className={styles.actions}>
                    {!isEditing ? (
                        <>
                            <button
                                onClick={() => setIsEditing(true)}
                                disabled={disableEditing}
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => regenerateMutation.mutate()}
                                disabled={disableRegenerate}
                            >
                                {regenerateMutation.isPending
                                    ? "Regenerating..."
                                    : "Regenerate"}
                            </button>

                            <button
                                onClick={() => setShowOriginal(true)}
                            >
                                Original Note
                            </button>

                            <button
                                onClick={() => deleteMutation.mutate()}
                                disabled={disableRegenerate}
                            >
                                Delete
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => updateMutation.mutate()}
                                disabled={disableEditing}
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                disabled={disableEditing}
                            >
                                Cancel
                            </button>
                        </>
                    )}

                </div>
            </div>

            {/* Category selector */}

            {isEditing && (
                <div className={styles.categoryButtons}>
                    {["meeting", "study", "interview"].map((cat) => (
                        <button
                            key={cat}
                            className={`${styles.categoryButton} ${editCategory === cat ? styles.active : ""}`}
                            onClick={() => setEditCategory(cat as "meeting" | "study" | "interview")}
                            disabled={disableEditing}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            <div className={styles.content}>
                {isEditing ? (
                    <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className={styles.editableContent}
                        autoFocus
                        rows={20}
                        disabled={disableEditing}
                    />
                ) : (
                    <div className={styles.viewContent}>
                        {isStreaming && (
                            <div className={styles.generating}>
                                <span className={styles.pulse}>✦ AI is generating your note...</span>
                            </div>
                        )}
                        {streamError ? (
                            <p className="text-red-500">{streamError}</p>
                        ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {note.content}
                            </ReactMarkdown>
                        )}
                    </div>
                )}
            </div>


            {/* Modal */}
            <OriginalNoteModal
                isOpen={showOriginal}
                onClose={() => setShowOriginal(false)}
                rawContent={note.rawContent}
                category={note.category}
            />

            <div className={styles.meta}>
                <span>createAt: {new Date(note.created).toISOString().slice(0, 10)}</span>
                {note.updated && (
                    <span>Last Updated: {new Date(note.updated).toISOString().slice(0, 10)}</span>
                )}
                <span>category: {note.category}</span>
            </div>
        </div>
    )
}

export default NoteEditor;