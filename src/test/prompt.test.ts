import { describe, it, expect } from "vitest";
import { getPromptForCategory } from '../utils/promptGenerator';

describe("getPromptForCategory", () => {
    it("returns structured prompt for 'meeting'", () => {
        const result = getPromptForCategory("Team discussed deadlines", "meeting");
        expect(result).toContain("structured summary");
        expect(result).toContain("Meeting Notes");
    });

    it("returns study summary prompt", () => {
        const result = getPromptForCategory("Some learning notes", "study");
        expect(result).toContain("core knowledge points");
        expect(result).toContain("Some learning notes");
    });

    it("returns interview summary prompt", () => {
        const result = getPromptForCategory("Interview with John", "interview");
        expect(result).toContain("interview feedback");
        expect(result).toContain("key questions");
    });

    it("returns default prompt for unknown category", () => {
        const result = getPromptForCategory("General content", "unknown");
        expect(result).toContain("summarize the following content");
    });
});
