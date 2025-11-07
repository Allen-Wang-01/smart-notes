import { useEffect, useState } from "react";
/**
 * useNoteStream
 * - Establishes an SSE connection to receive streaming note updates.
 * - Handles cleanup when component unmounts or streaming ends.
 */

export const useNoteStream = (noteId?: string) => {
    const [streaming, setStreaming] = useState(false)
    const [content, setContent] = useState("")
    const [done, setDone] = useState(false)

    useEffect(() => {
        if (!noteId) return

        const eventSource = new EventSource(`/api/notes/${noteId}/stream`, {
            withCredentials: true
        })

        setStreaming(true)
        setContent("")
        setDone(false)

        eventSource.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data)
                if (data.type === "start") {
                    setContent("")
                    setStreaming(true)
                } else if (data.type === "chunk") {
                    setContent((prev) => prev + data.content)
                } else if (data.type === "done") {
                    setStreaming(false)
                    setDone(true)
                }
            } catch (err) {
                console.error("SSE parse error: ", err)
            }
        }

        eventSource.onerror = () => {
            console.error("SSE connection failed")
            eventSource.close()
            setStreaming(false)
        }

        return () => {
            eventSource.close()
        }
    }, [noteId])

    return { content, streaming, done }
}