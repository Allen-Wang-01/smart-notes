import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import NoteEditor from "./NoteEditor";

const NotePage = () => {
    const { id } = useParams<{ id: string }>()
    const location = useLocation()

    //Check if this is a newly created note that should stream immediately
    const shouldStream = !!location.state?.shouldStream

    const { data, isLoading, isError } = useQuery({
        queryKey: ["note", id],
        queryFn: async () => {
            const res = await api.get(`/notes/${id}`)
            return res.data.note
        },
        enabled: !!id && !shouldStream, //Do NOT fetch if we're streaming a new note
        retry: 1,
        staleTime: 0,
    })
    // Case 1: New note → skip fetch, go straight to streaming
    if (shouldStream) {
        return (
            <NoteEditor
                note={{
                    id: id as string,
                    title: "Generating title...",
                    content: "",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    isProcessing: true,
                    category: "meeting", // fallback, will be updated by stream
                }}
            />
        );
    }

    // Case 2: Normal note loading
    if (isLoading) return <div>Loading note...</div>;
    if (isError || !data) return <div>Note not found</div>;

    return <NoteEditor note={data} />;
}

export default NotePage