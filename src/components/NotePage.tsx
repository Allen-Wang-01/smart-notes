import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import NoteEditor from "./NoteEditor";
import { useNoteStream } from "../hooks/useNoteStream";
import { useEffect, useMemo } from "react";
import styles from '../styles/NotePage.module.scss'

const NotePage = () => {
    const { id } = useParams<{ id: string }>()
    const location = useLocation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // 1. Determine whether to stream
    const shouldStream = location.state?.shouldStream === true;

    // 2. Stream (only when shouldStream === true)
    const {
        title: streamTitle,
        content: streamContent,
        isStreaming,
        error: streamError,
        renderDone,
    } = useNoteStream(id, shouldStream)

    // 3. Database request (only when NOT streaming)
    const { data: dbNote, isLoading, refetch, isError } = useQuery({
        queryKey: ["note", id],
        queryFn: async () => {
            const res = await api.get(`/notes/${id}`);
            return res.data.note;
        },
        enabled: !!id && !shouldStream && !isStreaming,
    });


    // When stream finishes → REFRESH DB

    useEffect(() => {
        if (shouldStream && !isStreaming && renderDone) {
            refetch() // refresh the note to sync categories / status / timestamp
            queryClient.invalidateQueries({ queryKey: ['notes'] }) // refresh sidebar
            // clean state so refresh does not trigger stream again
            navigate(`/note/${id}`, { replace: true })
        }
    }, [shouldStream, isStreaming, renderDone])

    //Merge data
    const note = useMemo(() => {
        if (shouldStream) {
            return {
                id,
                title: streamTitle || "Generating...",
                content: streamContent || "",
                created: dbNote?.created || new Date().toISOString(),
                updated: dbNote?.updated || "",
                status: "processing",
                category: dbNote?.category || "meeting",
            }
        }
        return dbNote
    }, [shouldStream, streamTitle, streamContent, dbNote, isStreaming])



    // 6. Loading / Error states
    if (isLoading) {
        return (
            <div className={styles.noteState}>
                <div className={styles.spinner} />
                <p>Loading note...</p>
            </div>
        );
    }

    if (isError || !note) {
        return (
            <div className={styles.noteState}>
                <p className={styles.errorText}>Note not found</p>
            </div>
        );
    }


    return <NoteEditor
        note={note}
        isStreaming={isStreaming}
        streamError={streamError}
    />;
}

export default NotePage