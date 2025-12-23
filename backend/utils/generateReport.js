import { z } from "zod"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"

const openai = new OpenAI

export async function generateReportText(prompt) {

    const ReportOutputSchema = z.object({
        summary: z.array(z.string()).min(1).max(4),
        poeticLine: z.string().min(5).max(200),
    })


    const response = await openai.responses.parse({
        model: "gpt-5-nano",
        input: [
            {
                role: "system",
                content:
                    "You are a thoughtful growth companion. Always respond in the requested JSON format."
            },
            {
                role: "user",
                content: prompt,
            },
        ],
        text: {
            format: zodTextFormat(ReportOutputSchema, "report")
        },
        store: false,
    })
    return response.output_parsed
}