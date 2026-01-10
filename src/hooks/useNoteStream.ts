import { useEffect, useState, useRef } from "react";
/**
 * Custom hook to handle real-time AI note generation via Server-Sent Events (SSE)
 * - Supports silky-smooth streaming with real-time title and content extraction
 * - Handles retries, final completion, and error states gracefully
 * - Automatically cleans up EventSource on unmount
 */

interface StreamData {
    title?: string;
    content?: string;
    keywords?: string[];
    summary?: string | null;
}

export const useNoteStream = (noteId?: string, enabled = false) => {
    const [title, setTitle] = useState("Generating title...")
    const [isStreaming, setIsStreaming] = useState(false)
    const [content, setContent] = useState("")
    const [isDone, setIsDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Prevent duplicate SSE connections
    const eventSourceRef = useRef<EventSource | null>(null)

    useEffect(() => {
        // If no noteId or streaming disabled → do nothing
        if (!noteId || !enabled) return

        // prevent duplicate SSE connections
        if (eventSourceRef.current) {
            // Already connected → do not re-connect
            return
        }

        setTitle("Generating title...")
        setContent("")
        setIsStreaming(true)
        setIsDone(false)
        setError(null)

        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

        // Create SSE connection
        const eventSource = new EventSource(`${API_BASE_URL}/notes/${noteId}/stream`, {
            withCredentials: true
        })

        eventSourceRef.current = eventSource

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data)
                // --------------------------
                // STREAM CONTENT CHUNKS
                // --------------------------
                if (data.type === "chunk") {
                    const delta = data.content || "";
                    setContent(prev => prev + delta);
                    return;
                }
                // --------------------------
                // FINAL JSON ARRIVES
                // --------------------------
                if (data.type === "done") {
                    const final: StreamData = data.data || {};

                    if (final.title) setTitle(final.title.trim());
                    if (final.content) setContent(final.content.trim());

                    setIsStreaming(false);
                    setIsDone(true);
                    eventSource.close();
                    eventSourceRef.current = null;
                    return;
                }
                // --------------------------
                // ERRORS
                // --------------------------
                if (data.type === "error") {
                    setError(data.message || "Unknown error")

                    if (!data.retry) {
                        // final failure
                        setIsStreaming(false)
                        setIsDone(true)
                        eventSource.close()
                        eventSourceRef.current = null
                    }
                }
            } catch (err) {
                console.error("SSE parse error: ", err)
            }
        }

        eventSource.onerror = () => {
            console.error("SSE connection lost");
            setTitle("Connection lost");
            setContent("Lost connection to server. Please refresh.");
            setError("Connection failed");
            setIsStreaming(false);
            eventSource.close();
            eventSourceRef.current = null;
        }
        // cleanup when component unmounts or noteId changes
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        }
    }, [noteId])

    return {
        title,
        content,
        isStreaming,
        isDone,
        error,
    }
}