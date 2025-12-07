import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../api/axios';

export interface NoteListItem {
    id: string;
    title: string;
    category: string;
    date: string;
    status: "pending" | "processing" | "retrying" | "completed" | "failed";
}

export interface NotesPage {
    notes: NoteListItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
}


export const useNotesInfiniteQuery = () => {
    return useInfiniteQuery<NotesPage>({
        queryKey: ['notes'],
        queryFn: async ({ pageParam = 1 }) => {
            const res = await api.get('/notes', {
                params: { page: pageParam, limit: 20 },
            });
            return res.data as NotesPage;
        },


        getNextPageParam: (lastPage) => {
            const { page, limit, total } = lastPage.pagination;
            const totalPages = Math.ceil(total / limit);
            return page < totalPages ? page + 1 : undefined;
        },

        initialPageParam: 1,
    });
};
