// export const getPromptForCategory = (content: string, category: string) => {
//     switch (category) {
//         case "meeting":
//             return `
//                     You are an assistant who summarizes meeting notes.

//                     Please read the notes below and provide a structured summary with:
//                     - Main decisions
//                     - Task assignments
//                     - Important deadlines

//                     Meeting Notes:
//                     ${content}`.trim();
//         case "study":
//             return `
//                     You are an assistant helping with study notes.

//                     Please summarize the core knowledge points and provide a concise reflection based on the following notes:
//                     ${content}
//                     `.trim();
//         case "interview":
//             return `
//                     You are an assistant that organizes interview feedback.

//                     Please extract key questions, answers, and suggestions for improvement from the following interview notes:
//                     ${content}
//                     `.trim();
//         default:
//             return `
//                 Please summarize the following content clearly and concisely:
//                 ${content}
//                 `.trim();
//     }
// };



export const getPromptForCategory = (content: string, category: "meeting" | "study" | "interview") => {
    switch (category) {
        case "meeting":
            return `You are an expert note organizer. Structure the following meeting notes into a clear, concise format with sections: Agenda, Key Points, Action Items. Input: ${content}`;
        case "study":
            return `You are a study assistant. Summarize the following study notes into a structured format with sections: Key Concepts, Examples, Questions. Input: ${content}`;
        case "interview":
            return `You are an interview coach. Organize the following interview notes into a structured format with sections: Questions, Responses, Reflections. Input: ${content}`;
        default:
            return `Summarize and structure the following notes: ${content}`;
    }
};