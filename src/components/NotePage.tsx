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

    // 3. Database request.
    // Runs while streaming too: the AI content arrives over SSE, but every
    // other field (rawContent, sourceType, timestamps) only exists in the DB.
    // Without this the streaming view renders a note with no original text.
    const { data: dbNote, isLoading, refetch, isError } = useQuery({
        queryKey: ["note", id],
        queryFn: async () => {
            const res = await api.get(`/notes/${id}`);
            return res.data.note;
        },
        enabled: !!id,
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
            // Spread the DB note first so fields the stream doesn't carry
            // (rawContent, sourceType, ...) stay present, then override only
            // what the stream is authoritative for.
            return {
                ...dbNote,
                id,
                title: streamTitle || dbNote?.title || "Generating...",
                content: streamContent || "",
                created: dbNote?.created || new Date().toISOString(),
                updated: dbNote?.updated || "",
                status: "processing",
            }
        }
        return dbNote
    }, [shouldStream, streamTitle, streamContent, dbNote, id])



    // 6. Loading / Error states
    // While streaming, the SSE content is already renderable — don't hide it
    // behind the spinner just because the DB fetch is still in flight.
    if (isLoading && !shouldStream) {
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