import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import NoteEditor from "./NoteEditor";

const NotePage = () => {
    const { id } = useParams<{ id: string }>()

    const { data, isLoading, isError } = useQuery({
        queryKey: ["note", id],
        queryFn: async () => {
            const res = await api.get(`/notes/${id}`)
            return res.data.note
        },
        enabled: !!id, //only make request if id exists
    })

    if (isLoading) return <div>Loading note...</div>
    if (isError || !data) return <div>Note not found.</div>

    return <NoteEditor note={data} />
}

export default NotePage