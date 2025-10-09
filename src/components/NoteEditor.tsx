import { useContext, useState, useEffect } from "react";
import NoteContext from "../context/NoteContext";
import toast from "react-hot-toast";
import styles from '../styles/NoteEditor.module.scss'
import axios from "axios";
import { getPromptForCategory } from "../utils/promptGenerator";

interface Note {
    id: string;
    title: string;
    content: string;
    date: string;
    category: "meeting" | "study" | "interview";
}

interface NoteEditorProps {
    note: Note;
}



const NoteEditor = ({ note }: NoteEditorProps) => {
    const noteContext = useContext(NoteContext)
    if (!noteContext) return null
    const { dispatch } = noteContext

    const [isEditing, setIsEditing] = useState(false)
    const [editedTitle, setEditedTitle] = useState(note.title)
    const [editedContent, setEditedContent] = useState(note.content)
    const [editedCategory, setEditedCategory] = useState(note.category)
    const [isLoading, setIsLoading] = useState(false)
    const [contentUpdated, setContentUpdated] = useState(false) //label updated content

    // 修复 bug：监听 note 变化，更新状态
    useEffect(() => {
        setEditedTitle(note.title);
        setEditedContent(note.content);
        setEditedCategory(note.category);
        setIsEditing(false); // 切换笔记时退出编辑模式
        setContentUpdated(false); // 重置更新标记
    }, [note]);


    // update logic when regenerate content
    const handleRegenerateContent = async () => {
        if (!editedContent.trim()) {
            toast.error("内容不能为空");
            return;
        }
        const backupContent = editedContent //save backup
        setIsLoading(true);
        setEditedContent("Regenerating content")
        const toastId = toast.loading("Regenting content, Please wait for a moment")
        try {
            const prompt = getPromptForCategory(editedContent, editedCategory);
            const response = await axios.post("http://localhost:3001/api/openai", {
                prompt,
                model: "gpt-3.5-turbo",
                max_tokens: 400,
            });
            const regeneratedContent = response.data.choices[0].text.trim();
            setEditedContent(regeneratedContent);
            toast.success("内容已重新整理");
        } catch (error) {
            console.error("Open AI API error:", error);
            setEditedContent(backupContent) // rollback to last edition
            toast.error("regenerate failed, try again later", { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (!editedContent.trim() || !editedTitle.trim()) {
            toast.error("Title and Content can't be empty")
            return
        }

        const updatedNote = {
            ...note,
            title: editedTitle,
            content: editedContent,
            category: editedCategory,
        }
        dispatch({ type: "UPDATE_NOTE", payload: updatedNote });
        setIsEditing(false)
        toast.success("successfully edited")
    }
    const handleDelete = () => {
        dispatch({ type: "DELETE_NOTE", payload: note.id })
        toast.success("successfully deleted", { duration: 4000 })
    }

    return (
        <div className={styles.editorWrapper}>
            <div className={styles.header}>
                {isEditing ? (
                    <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        placeholder="Enter the title"
                        className={styles.titleInput}
                    />
                ) : (
                    <h2>{note.title}</h2>
                )}
                <div className={styles.actions}>
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} disabled={isLoading}>
                                保存
                            </button>
                            <button onClick={() => setIsEditing(false)}>取消</button>
                            <button onClick={handleRegenerateContent} disabled={isLoading}>
                                {isLoading ? (
                                    <svg
                                        className={styles.spinner}
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        width="16"
                                        height="16"
                                    >
                                        <path
                                            d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8z"
                                            opacity=".3"
                                        />
                                        <path d="M12 22c5.52 0 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8V2C6.48 2 2 6.48 2 12s4.48 10 10 10z" />
                                    </svg>
                                ) : (
                                    "重新整理"
                                )}
                            </button>
                        </>
                    ) : (<>
                        <button onClick={handleDelete}>删除</button>
                        <button onClick={() => setIsEditing(true)}>编辑</button>
                    </>)}
                </div>
            </div>

            {isEditing && (
                <div className={styles.categoryButtons}>
                    {["meeting", "study", "interview"].map((cat) => (
                        <button
                            key={cat}
                            className={`${styles.categoryButton} ${editedCategory === cat ? styles.active : ""}`}
                            onClick={() => setEditedCategory(cat as "meeting" | "study" | "interview")}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            <div className={styles.content}>
                {isEditing ? (
                    <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className={`${styles.editableContent} ${contentUpdated ? styles.updated : ""}`}
                        autoFocus
                        rows={10}
                        disabled={isLoading}
                    />
                ) : (
                    <div
                        className={styles.viewContent}
                        dangerouslySetInnerHTML={{ __html: note.content.replace(/\n/g, "<br>") }}
                    />
                )}
            </div>


            <div className={styles.meta}>
                <span>创建时间: {new Date(note.date).toLocaleString()}</span>
                <span>分类: {note.category}</span>
            </div>
        </div>
    )
}

export default NoteEditor;