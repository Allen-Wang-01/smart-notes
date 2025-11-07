import toast from "react-hot-toast";
import { useState } from "react";
import styles from '../styles/NoteEditor.module.scss'
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNoteStream } from "../hooks/useNoteStream";

interface Note {
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
    const [title, setTitle] = useState(note.title || "")
    const [content, setContent] = useState(note.content || "")
    const [category, setCategory] = useState(note.category)
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    //only listen to stream event when note.isProcessing is true
    const { content: streamContent, streaming } = useNoteStream(
        note.isProcessing ? note.id : undefined
    )

    //update note
    const updateMutation = useMutation({
        mutationFn: async () => {
            if (!title) {
                toast.error("title can't be empty")
                return
            } else if (!content) {
                toast.error("content can't be empty")
                return
            }
            const res = await api.patch(`/notes/${note.id}`, {
                title,
                content,
                category,
            })
            return res.data.note
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] })
        }
    })

    //delete note
    const deleteMutation = useMutation({
        mutationFn: async () => {
            await api.delete(`/notes/${note.id}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] })
            navigate('/')
        }
    })

    //regenerateNote 
    const regenerateMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/notes/${note.id}/regenerate`)
            //set processing = true to trigger stream event
            queryClient.setQueryData(["notes"], (old: any) => {
                if (!old) return old
                return {
                    ...old,
                    pages: old.pages.map((page: any) => ({
                        ...page,
                        notes: page.notes.map((n: any) => {
                            n.id === note.id ? { ...n, isProcessing: true } : n
                        })
                    }))
                }
            })
        }
    })

    //disply according to the processing state
    const displayContent = note.isProcessing
        ? (streamContent || "").replace(/\n/g, "<br>")
        : (content || "").replace(/\n/g, "<br>");


    return (
        <div className={styles.editorWrapper}>
            <div className={styles.header}>
                {isEditing ? (
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter the title"
                        className={styles.titleInput}
                    />
                ) : (
                    <h2>{title}</h2>
                )}
                <div className={styles.actions}>
                    {isEditing ? (
                        <>
                            <button onClick={() => updateMutation.mutate()} disabled={streaming || regenerateMutation.isPending}>
                                Save
                            </button>
                            <button onClick={() => setIsEditing((v) => !v)} disabled={streaming || regenerateMutation.isPending}>{isEditing ? "Cancel" : "Edit"}</button>
                            <button onClick={() => regenerateMutation.mutate()} disabled={streaming || regenerateMutation.isPending}>
                                {streaming ? (
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
                        <button onClick={() => deleteMutation.mutate()} disabled={streaming || regenerateMutation.isPending}>Delete</button>
                    </>)}
                </div>
            </div>

            {isEditing && (
                <div className={styles.categoryButtons}>
                    {["meeting", "study", "interview"].map((cat) => (
                        <button
                            key={cat}
                            className={`${styles.categoryButton} ${category === cat ? styles.active : ""}`}
                            onClick={() => setCategory(cat as "meeting" | "study" | "interview")}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            <div className={styles.content}>
                {isEditing ? (
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className={`${styles.editableContent}`}
                        autoFocus
                        rows={10}
                        disabled={streaming}
                    />
                ) : (
                    <div
                        className={styles.viewContent}
                        dangerouslySetInnerHTML={{ __html: displayContent, }}
                    />
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