import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper to get the API Key from localStorage
const getApiKey = (): string | null => {
  return localStorage.getItem('studysync_gemini_api_key');
};

// Helper to check if API key exists
export const hasApiKey = (): boolean => {
  return !!getApiKey();
};

// Initialize Gemini Client
const getGenAI = (): GoogleGenerativeAI => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add your key in Settings.');
  }
  return new GoogleGenerativeAI(apiKey);
};

// Validate API Key
export async function validateApiKey(key: string): Promise<boolean> {
  try {
    const tempGenAI = new GoogleGenerativeAI(key);
    const model = tempGenAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Respond with OK' }] }]
    });
    return result.response.text().trim().includes('OK');
  } catch (error) {
    console.error('API Key validation failed:', error);
    return false;
  }
}

// Generate Study Plan
export async function generateStudyPlan(params: {
  courseName: string;
  targetDate: string;
  syllabus: string;
  hoursPerDay: number;
  knowledgeLevel: string;
}): Promise<{ title: string; tasks: Array<{ date: string; title: string; description: string }> }> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    }
  });

  const prompt = `
    You are an expert academic planner. Generate a detailed, day-by-day study plan leading up to the target date.
    
    Parameters:
    - Course Name: ${params.courseName}
    - Target Date (Exam/Deadline): ${params.targetDate}
    - Syllabus/Topics to cover: ${params.syllabus}
    - Target study hours per day: ${params.hoursPerDay} hours
    - Current knowledge level: ${params.knowledgeLevel}
    - Today's date is: ${new Date().toISOString().split('T')[0]}

    Create a realistic plan that structures the learning material. Ensure you cover all topics from the syllabus, distribute hours logically, and include review sessions closer to the target date.

    Respond with a JSON object of this exact schema:
    {
      "title": "Study Plan for [Course Name]",
      "tasks": [
        {
          "date": "YYYY-MM-DD",
          "title": "Topic / Core Goal for the Day",
          "description": "Detailed study tasks, specific subtopics, and what to focus on in ${params.hoursPerDay} hours."
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  return JSON.parse(responseText);
}

// Estimate Study Time and Breakdown for Assignment
export async function estimateAssignmentTime(params: {
  title: string;
  description: string;
  subject: string;
}): Promise<{ estimatedHours: number; steps: Array<{ title: string; duration: string; description: string }> }> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    }
  });

  const prompt = `
    You are an academic advisor. Analyze the following assignment and estimate the total hours needed to complete it, along with a structured breakdown of the steps.

    Assignment Details:
    - Title: ${params.title}
    - Subject: ${params.subject}
    - Description: ${params.description}

    Provide a realistic hour estimate and a logical step-by-step checklist (e.g. Research, Drafting, Editing, Formatting).

    Respond with a JSON object of this exact schema:
    {
      "estimatedHours": 8.5,
      "steps": [
        {
          "title": "Step Title (e.g., Preliminary Research)",
          "duration": "2.5 hours",
          "description": "Specific actions to take for this step."
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

// NotebookLM-style Source Chat
export async function chatWithSources(params: {
  sources: Array<{ name: string; text: string }>;
  query: string;
  history: Array<{ role: 'user' | 'model'; parts: string }>;
}): Promise<string> {
  const genAI = getGenAI();
  
  // Design system prompt
  const systemInstruction = `
    You are StudySync AI, an advanced research assistant modelled after NotebookLM.
    Your task is to answer the user's questions using ONLY the uploaded source documents.
    
    Here is the content of the uploaded sources:
    ${params.sources.map((s, idx) => `--- SOURCE ${idx + 1}: ${s.name} ---\n${s.text}\n--- END SOURCE ${idx + 1} ---`).join('\n\n')}

    Rules:
    1. Answer the query relying ONLY on the provided sources. Do not make up facts or use external knowledge.
    2. If the answer cannot be found or inferred from the sources, state: "I cannot find this information in the uploaded sources."
    3. Be thorough and detailed where appropriate, quoting or summarizing key details.
    4. For every claim you make that comes from a source, you MUST cite the source filename in square brackets at the end of the sentence, for example: "The primary engine has a thrust of 500kN [rocket_specifications.pdf]."
    5. Respond in clear Markdown format.
  `;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemInstruction,
  });

  const chat = model.startChat({
    history: params.history.map(h => ({
      role: h.role,
      parts: [{ text: h.parts }]
    }))
  });

  const result = await chat.sendMessage(params.query);
  return result.response.text();
}

// Generate Flashcards from Sources
export async function generateFlashcards(sources: Array<{ name: string; text: string }>): Promise<Array<{ front: string; back: string }>> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
    Based on the uploaded study sources, extract key concepts, terms, dates, and definitions to create a set of high-yield study flashcards.
    
    Sources:
    ${sources.map((s) => `Source [${s.name}]:\n${s.text.substring(0, 10000)}`).join('\n\n')}

    Generate at least 8-15 distinct cards. Ensure the front has a concise question/concept and the back has a clear, explanatory definition/answer.

    Respond with JSON:
    {
      "flashcards": [
        {
          "front": "Question/Term",
          "back": "Answer/Definition"
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const data = JSON.parse(result.response.text());
  return data.flashcards || [];
}

// Generate Quiz from Sources
export async function generateQuiz(sources: Array<{ name: string; text: string }>): Promise<Array<{
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}>> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
    Based on the uploaded study sources, generate an interactive multiple-choice quiz to test the user's understanding.
    
    Sources:
    ${sources.map((s) => `Source [${s.name}]:\n${s.text.substring(0, 10000)}`).join('\n\n')}

    Create 5-10 challenging but fair multiple-choice questions. Each question must have 4 options and a clear explanation of why the correct option is right.

    Respond with JSON:
    {
      "questions": [
        {
          "question": "Question text?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "answerIndex": 0, // 0-indexed index of the correct option
          "explanation": "Explanation of the correct answer based on sources."
        }
      ]
    }
  `;

  const result = await model.generateContent(prompt);
  const data = JSON.parse(result.response.text());
  return data.questions || [];
}

// Generate Summary from Sources
export async function generateSummary(sources: Array<{ name: string; text: string }>): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  const prompt = `
    Create a comprehensive, structured study guide and summary based on the uploaded sources.
    
    Sources:
    ${sources.map((s) => `Source [${s.name}]:\n${s.text.substring(0, 15000)}`).join('\n\n')}

    Your summary should include:
    1. A High-Level Overview.
    2. Key Concepts & Definitions (bulleted list).
    3. Major Themes or Subtopics explained in detail.
    4. Formulas, equations, dates, or key citations if present.
    5. A Brief Conclusion.

    Use headings, lists, bold text, and markdown styling to make it look professional and readable.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
