// src/utils/noteSubmit.ts
import axios from "axios";
import { getPromptForCategory } from "../utils/promptGenerator";
import { generateTitleWithHuggingFace } from "../utils/generateTitle";
import { v4 as uuidv4 } from "uuid";

export async function submitNote({ content, category }: { content: string; category: string }) {
    const prompt = getPromptForCategory(content, category);

    const contentResponse = await axios.post("http://localhost:xxxx/api/huggingface", {
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

    return newNote;
}
