import { useState } from "react";
import { submitNote } from '../utils/noteSubmit'

export const useNoteSubmit = () => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<null | string>(null)

    const handleSubmit = async ({
        content,
        category,
        onSuccess,
        onError,
    }: {
        content: string;
        category: string;
        onSuccess: (note: any) => void;
        onError: (err: any) => void;
    }) => {
        if (!content.trim()) {
            onError("请输入笔记内容")
            return
        }
        try {
            setLoading(true)
            const newNote = await submitNote({ content, category })
            onSuccess(newNote)
        } catch (error) {
            setError("提交失败")
            onError(error)
        } finally {
            setLoading(false)
        }
    }
    return { handleSubmit, loading, error }
}