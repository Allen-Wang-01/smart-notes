import { describe, it, expect, vi } from "vitest";
import axios from "axios";
import { generateTitleWithHuggingFace } from "../utils/generateTitle";

// 模拟 axios
vi.mock("axios");
const mockedAxios = axios as unknown as {
    post: ReturnType<typeof vi.fn>;
};

describe("generateTitleWithHuggingFace", () => {
    it("should return generated title from Hugging Face API", async () => {
        mockedAxios.post = vi.fn().mockResolvedValue({
            data: [{ generated_text: "New App Meeting Plan" }],
        });

        const title = await generateTitleWithHuggingFace("Team meeting about new app", "meeting");

        expect(title).toBe("New App Meeting Plan");
        expect(mockedAxios.post).toHaveBeenCalledOnce();
    });

    it("should return default fallback title on error (meeting)", async () => {
        mockedAxios.post = vi.fn().mockRejectedValue(new Error("API error"));

        const fallbackTitle = await generateTitleWithHuggingFace("Some meeting notes", "meeting");

        expect(fallbackTitle).toMatch(/^会议记录 - \d{1,2}\/\d{1,2}\/\d{4}$/);
    });

    it("should return default fallback title on error (study)", async () => {
        mockedAxios.post = vi.fn().mockRejectedValue(new Error("API error"));

        const fallbackTitle = await generateTitleWithHuggingFace("Some study notes", "study");

        expect(fallbackTitle).toMatch(/^学习总结 - \d{1,2}\/\d{1,2}\/\d{4}$/);
    });

    it("should return default fallback title on error (interview)", async () => {
        mockedAxios.post = vi.fn().mockRejectedValue(new Error("API error"));

        const fallbackTitle = await generateTitleWithHuggingFace("Interview Q&A", "interview");

        expect(fallbackTitle).toMatch(/^面试复盘 - \d{1,2}\/\d{1,2}\/\d{4}$/);
    });
});
