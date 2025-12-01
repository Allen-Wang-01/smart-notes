import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

interface CreateNoteData {
    rawContent: string;
    category?: 'meeting' | 'study' | 'interview'
}

interface CreateNoteResponse {
    message: string,
    note: {
        id: string;
        title: string;
        category: string;
        date: string;
        isProcessing: boolean;
    }
}

export const useCreateNoteMutation = () => {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    return useMutation({
        mutationFn: async (data: CreateNoteData): Promise<CreateNoteResponse> => {
            const response = await api.post('/notes', data)
            return response.data
        },
        onSuccess: (data) => {
            const newNoteId = data.note.id
            //Invalidate notes list to trigger refetch
            queryClient.invalidateQueries({ queryKey: ['notes'] })
            toast.success('Note Created! AI is organizing your content...')
            //update for sidebar
            queryClient.setQueryData(['notes'], (old: any) => {
                if (!old?.pages?.length) return old

                const newNote = {
                    ...data.note,
                    // Ensure correct shape for your sidebar
                    id: newNoteId,
                    title: "Generating title...", // Show placeholder during streaming
                    isProcessing: true,
                };

                return {
                    ...old,
                    pages: [
                        {
                            ...old.pages[0],
                            notes: [newNote, ...old.pages[0].notes],
                        },
                        ...old.pages.slice(1),
                    ],
                };
            })
            toast.success("Note created! AI is organizing your content...");

            //  Navigate to note page + trigger streaming
            navigate(`/notes/${newNoteId}`, {
                state: { shouldStream: true }, // Tell NotePage to start streaming immediately
                replace: true, //  cleaner history (no back to empty form)
            });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to create note')
        }
    })
}