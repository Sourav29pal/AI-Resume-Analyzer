const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

const generateInterviewPrompt = (resume, selfDescription, jobDescription) => `
You are a high-level Technical Recruiter. Analyze the provided Resume, Self-Description, and Job Description.

CRITICAL INSTRUCTIONS: 
1. You MUST return a JSON object strictly following the key structure below.
2. QUANTITY RULE: You MUST generate a MINIMUM of 3 items for every array. There is NO UPPER LIMIT. Generate as many questions, skill gaps, and preparation days as necessary to create a highly comprehensive report based on the candidate's data.

### EXPECTED JSON STRUCTURE:
{
  "title": "Job title based on description",
  "matchScore": 85,
  "technicalQuestions": [
    { "question": "...", "intention": "...", "answer": "..." }
  ],
  "behavioralQuestions": [
    { "question": "...", "intention": "...", "answer": "..." }
  ],
  "skillGaps": [
    { "skill": "...", "severity": "low" }
  ],
  "preparationPlan": [
    { "day": 1, "focus": "...", "tasks": ["...", "..."] }
  ]
}

### DATA TO ANALYZE:
Resume: 
"""
${resume}
"""

Self Description: 
"""
${selfDescription}
"""

Job Description: 
"""
${jobDescription}
"""
`;

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = generateInterviewPrompt(resume, selfDescription, jobDescription);

    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json" },
            });

            // Clean markdown backticks and parse the JSON
            const cleanJson = result.text.replace(/```json|```/g, "").trim();
            const parsedData = JSON.parse(cleanJson);

            // Fallback defaults to protect Mongoose from undefined fields
            return {
                title: parsedData.title || "Software Engineer Interview",
                matchScore: parsedData.matchScore || 0,
                technicalQuestions: parsedData.technicalQuestions || [],
                behavioralQuestions: parsedData.behavioralQuestions || [],
                skillGaps: parsedData.skillGaps || [],
                preparationPlan: parsedData.preparationPlan || [],
            };

        } catch (error) {
            attempt++;
            
            // Handle Google's 503 Overloaded errors gracefully
            if (error.message && error.message.includes("503")) {
                console.warn(`[AI] Server overloaded. Retrying ${attempt}/${MAX_RETRIES}...`);
                if (attempt >= MAX_RETRIES) throw new Error("Google AI unavailable after multiple attempts.");
                
                // Wait 2 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 2000)); 
            } else {
                console.error("AI Generation/Parsing Error:", error.message);
                throw new Error("Failed to generate or parse the report.");
            }
        }
    }
}

module.exports = { generateInterviewReport };