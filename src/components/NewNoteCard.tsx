import { useState, useContext } from "react";
import { getPromptForCategory } from '../utils/promptGenerator'
import toast from "react-hot-toast";
import { v4 as uuidv4 } from 'uuid'
import styles from '../styles/NewNoteCard.module.scss'
import axios from "axios";
import TextareaAutosize from "react-textarea-autosize";


interface NewNoteCardProps {
    dispatch: React.Dispatch<any>;
    onNoteAdded: (noteId: string) => void; // 新增回调，用于跳转
}

const NewNoteCard = ({ dispatch, onNoteAdded }: NewNoteCardProps) => {
    const [content, setContent] = useState("")
    const [category, setCategory] = useState<"meeting" | "study" | "interview">("meeting");
    const [isLoading, setIsLoading] = useState(false)
    const [continueCreating, setContinueCreating] = useState(false) //fast creating

    const generateTitleWithHuggingFace = async (content: string, category: string) => {
        try {
            const titlePrompt = `Generate a concise and descriptive title (no more than 10 words) for the following content:\n${content}`;
            const response = await axios.post("http://localhost:3001/api/huggingface", {
                prompt: titlePrompt,
                model: "google/flan-t5-base", // 更适合做标题生成的模型
                maxLength: 10,
            });
            return response.data[0].generated_text.trim();
        } catch (error) {
            console.error("Title generation error:", error);
            return `${category === "meeting" ? "会议记录" : category === "study" ? "学习总结" : "面试复盘"} - ${new Date().toLocaleDateString()}`;
        }
    };


    const handleSubmit = async () => {
        if (!content.trim()) {
            toast.error("Please enter the note content")
            return;
        }
        setIsLoading(true)

        try {
            const prompt = getPromptForCategory(content, category);

            const contentResponse = await axios.post("http://localhost:3001/api/huggingface", {
                prompt,
                model: "mistralai/Mistral-7B-Instruct-v0.2",
                maxLength: 400,
            });
            const processedContent = contentResponse.data[0].generated_text;


            const generatedTitle = await generateTitleWithHuggingFace(content, category);
            const newNote = {
                id: uuidv4(),
                title: generatedTitle,
                content: processedContent,
                date: new Date().toISOString(),
                category,
            };

            dispatch({ type: "ADD_NOTE", payload: newNote });
            toast.success("Note has been saved, click the sidebar to review", {
                duration: 4000,
            })
            if (!continueCreating) {
                setContent("")
                setCategory("meeting")
            } else {
                setContent("") //keep the catefory, but clear the content
            }
            onNoteAdded(newNote.id);  // 通知父组件跳转
        } catch (error) {
            console.error("Hugging Face API error:", error);
            toast.error("failed, please try again")
        } finally {
            setIsLoading(false)
        }
    }


    return (
        <div className={styles.newNoteCard}>
            <TextareaAutosize
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Please enter the content..."
                minRows={3}
                maxRows={10}
                className={styles.textarea}
            />
            <div className={styles.container}>
                <div className={styles.categoryButtons}>
                    {["meeting", "study", "interview"].map((cat) => (
                        <button
                            key={cat}
                            className={`${styles.categoryButton} ${category === cat ? styles.active : ""}`}
                            onClick={() =>
                                setCategory(cat as "meeting" | "study" | "interview")
                            }
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <label className={styles.continueCreating}>
                    <input
                        type="checkbox"
                        checked={continueCreating}
                        onChange={(e) => setContinueCreating(e.target.checked)}
                    />
                    继续创建
                </label>

                <button onClick={handleSubmit} className={styles.sendButton}
                    onKeyDown={(e) => {
                        if (content.trim() !== '' && e.key === 'Enter' && !isLoading) {
                            handleSubmit()
                        }
                    }}>
                    {isLoading ? (
                        <svg
                            className={styles.spinner}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                        >
                            <path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8z" opacity=".3" />
                            <path d="M12 22c5.52 0 10-4.48 10-10h-2c0 4.41-3.59 8-8 8s-8-3.59-8-8 3.59-8 8-8V2C6.48 2 2 6.48 2 12s4.48 10 10 10z" />
                        </svg>
                    ) : (
                        <svg
                            className={styles.arrowIcon}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            width="20"
                            height="20"
                        >
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    )
}

export default NewNoteCard;