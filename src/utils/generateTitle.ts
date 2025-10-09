import axios from "axios";
export const generateTitleWithHuggingFace = async (content: string, category: string) => {
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