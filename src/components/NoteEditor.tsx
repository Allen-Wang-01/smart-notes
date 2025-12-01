import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import styles from '../styles/NoteEditor.module.scss'
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNoteStream } from "../hooks/useNoteStream";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface Note {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    isProcessing: boolean;
    category: "meeting" | "study" | "interview";
}

interface NoteEditorProps {
    note: Note;
}

const NoteEditor = ({ note }: NoteEditorProps) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editTitle, setEditTitle] = useState(note.title || "Untitled")
    const [editContent, setEditContent] = useState(note.content || "")
    const [editCategory, setEditCategory] = useState(note.category)
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    //only listen to stream event when note.isProcessing is true
    const stream = useNoteStream(note.isProcessing ? note.id : undefined)
    const { title: streamTitle, content: streamContent, isStreaming, error } = stream

    useEffect(() => {
        if (!isEditing && !note.isProcessing && streamTitle && streamContent) {
            setEditTitle(streamTitle);
            setEditContent(streamContent);
        }
    }, [streamTitle, streamContent, note.isProcessing, isEditing]);

    //update note
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!editTitle.trim()) throw new Error("Title cannot be empty")
            if (!editContent.trim()) throw new Error("Content cannot be empty")
            const res = await api.patch(`/notes/${note.id}`, {
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
        },
    })

    //disply according to the processing state
    const displayTitle = isEditing ? editTitle : (streamTitle || note.title || "Untitled");
    const displayContent = isEditing ? editContent : (streamContent || note.content || "");


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
                        autoFocus
                    />
                ) : (
                    <h2>{displayTitle}
                        {isStreaming && <span className={styles.cursor}>|</span>}
                    </h2>
                )}
                <div className={styles.actions}>
                    {isEditing ? (
                        <>
                            <button onClick={() => updateMutation.mutate()} disabled={isStreaming || regenerateMutation.isPending}>
                                Save
                            </button>
                            <button onClick={() => setIsEditing((v) => !v)} disabled={isStreaming || regenerateMutation.isPending}>{isEditing ? "Cancel" : "Edit"}</button>
                            <button onClick={() => regenerateMutation.mutate()} disabled={isStreaming || regenerateMutation.isPending}>
                                {isStreaming ? (
                                    <svg
                                        className={styles.spinner}
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        width="16"
                                        height="16"
                                    >
                                        <path
                                            d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8z"
                                            opacity=".3"
                                        />
                                        <path d="M12 22c5.52 0 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8V2C6.48 2 2 6.48 2 12s4.48 10 10 10z" />
                                    </svg>
                                ) : (
                                    "Regenerate"
                                )}
                            </button>
                        </>
                    ) : (<>
                        <button onClick={() => deleteMutation.mutate()} disabled={isStreaming || regenerateMutation.isPending}>Delete</button>
                    </>)}
                </div>
            </div>

            {isEditing && (
                <div className={styles.categoryButtons}>
                    {["meeting", "study", "interview"].map((cat) => (
                        <button
                            key={cat}
                            className={`${styles.categoryButton} ${editCategory === cat ? styles.active : ""}`}
                            onClick={() => setEditCategory(cat as "meeting" | "study" | "interview")}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            <div className={styles.content}>
                {isEditing ? (
                    <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className={`${styles.editableContent}`}
                        autoFocus
                        rows={20}
                        disabled={isStreaming}
                    />
                ) : (
                    <div className={styles.viewContent}>
                        {error ? (
                            <p className="text-red-500">{error}</p>
                        ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {displayContent}
                            </ReactMarkdown>
                        )}
                    </div>
                )}
            </div>


            <div className={styles.meta}>
                <span>createAt: {new Date(note.createdAt).toLocaleDateString()}</span>
                {note.updatedAt && (
                    <span>Last Updated: {new Date(note.updatedAt).toLocaleString()}</span>
                )}
                <span>category: {note.category}</span>
            </div>
        </div>
    )
}

export default NoteEditor;