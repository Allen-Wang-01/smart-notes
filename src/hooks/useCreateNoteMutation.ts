import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "../api/axios";

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
    const querClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: CreateNoteData): Promise<CreateNoteResponse> => {
            const response = await api.post('/api/notes', data)
            return response.data
        },
        onSuccess: (data) => {
            //Invalidate notes list to trigger refetch
            querClient.invalidateQueries({ queryKey: ['notes'] })
            toast.success('Note Created! AI is organizing your content...')
            //update for sidebar
            querClient.setQueryData(['notes'], (old: any) => {
                if (!old) return old
                return {
                    ...old,
                    pages: old.pages.map((page: any, index: number) =>
                        index === 0
                            ? { ...page, notes: [data.note, ...page.notes] }
                            : page
                    )
                }
            })
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to create note')
        }
    })
}