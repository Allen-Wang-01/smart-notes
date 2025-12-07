/**
 * Fix database content stored with double-escaped sequences.
 * Example: "## Title\\nLine1\\nLine2" → "## Title\nLine1\nLine2"
 */
export function decodeDoubleEscapedMarkdown(input) {
    if (!input) return "";

    return input
        // Convert double-escaped newline to real newline
        .replace(/\\\\n/g, "\n")

        // Convert double-escaped tabs to real tabs
        .replace(/\\\\t/g, "\t")

        // Convert escaped quotes (\" → ")
        .replace(/\\"/g, '"')

        // Convert escaped backslash (\\ → \)
        // MUST be last to avoid breaking previous patterns
        .replace(/\\\\/g, "\\");
}
