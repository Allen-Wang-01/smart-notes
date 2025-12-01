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

export const useNoteStream = (noteId?: string) => {
    const [title, setTitle] = useState("Generating title...")
    const [isStreaming, setIsStreaming] = useState(false)
    const [content, setContent] = useState("")
    const [isDone, setIsDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const bufferRef = useRef<string>("")

    useEffect(() => {
        if (!noteId) return

        setTitle("Generating title...")
        setContent("")
        setIsStreaming(true)
        setIsDone(false)
        setError(null)
        bufferRef.current = ""

        const eventSource = new EventSource(`/api/notes/${noteId}/stream`, {
            withCredentials: true
        })

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data)
                if (data.type === "chunk" && typeof data.content === "string") {
                    bufferRef.current += data.content

                    const titleMatch = bufferRef.current.match(/"title"\s*:\s*"([^"]*?)"/)
                    if (titleMatch && titleMatch[1].trim()) {
                        setTitle(titleMatch[1].trim());
                    }

                    const contentMatch = bufferRef.current.match(/"content"\s*:\s*"([\s\S]*?)"/);
                    if (contentMatch) {
                        const cleaned = contentMatch[1]
                            .replace(/\\n/g, "\n")
                            .replace(/\\"/g, '"')
                            .replace(/\\t/g, "\t");
                        setContent(cleaned);
                    }
                }
                if (data.type === "done" && data.data) {
                    const final = data.data as StreamData;
                    setTitle(final.title?.trim() || "Untitled");
                    setContent(final.content?.trim() || content);
                    setIsDone(true);
                    setIsStreaming(false);
                    eventSource.close();
                }

                if (data.type === "error") {
                    if (data.retry) {
                        setTitle(`Retrying... (${data.message.split("(")[1] || ""}`);
                    } else {
                        setTitle("Generation failed");
                        setContent("AI processing failed after all retries. Your original note is safe.");
                        setError(data.message);
                        setIsStreaming(false);
                        setIsDone(true);
                        eventSource.close();
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
        }

        return () => {
            eventSource.close()
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