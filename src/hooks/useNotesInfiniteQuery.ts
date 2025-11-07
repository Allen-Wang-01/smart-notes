// src/hooks/useNotesInfiniteQuery.ts
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

export interface NoteListItem {
    id: string;
    title: string;
    category: string;
    date: string;
    isProcessing?: boolean;
    streamingContent?: string;
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


export const useAddNoteMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newNote: Omit<NoteListItem, 'id' | 'date'>) => {
            const res = await api.post('/notes', newNote);
            return res.data as NoteListItem;
        },

        onMutate: async (newNote) => {
            await queryClient.cancelQueries({ queryKey: ['notes'] });
            const previous = queryClient.getQueryData<{ pages: NotesPage[]; pageParams: unknown[] }>(['notes']);

            const placeholder: NoteListItem = {
                id: `temp-${Date.now()}`,
                title: 'Processing...',
                category: newNote.category || 'study',
                date: new Date().toISOString(),
                isProcessing: true,
                streamingContent: '',
            };

            queryClient.setQueryData(['notes'], (old: any) => {
                if (!old) {
                    return {
                        pages: [{ notes: [placeholder], pagination: { page: 1, limit: 20, total: 1 } }],
                        pageParams: [1],
                    };
                }

                const firstPage = old.pages[0] ?? { notes: [], pagination: { page: 1, limit: 20, total: 0 } };
                return {
                    ...old,
                    pages: [
                        { ...firstPage, notes: [placeholder, ...(firstPage.notes || [])] },
                        ...old.pages.slice(1),
                    ],
                };
            });

            return { previous };
        },

        onError: (_err, _newNote, context) => {
            if (context?.previous) {
                queryClient.setQueryData(['notes'], context.previous);
            }
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notes'] });
        },
    });
};
