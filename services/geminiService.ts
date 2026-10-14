import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { UserProfile, GeneratedSnack, SnackDetails, Nutrition, ImageClassificationResult, Challenge, JournalEntry, Mood } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schemas
const snackGenerationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'The name of the snack.' },
      classification: { type: Type.STRING, enum: ["Healthy", "Unhealthy"], description: 'Classification of the snack.' },
      reason: { type: Type.STRING, description: 'A brief, scientific reason for the classification (max 15 words).' },
    },
    required: ["name", "classification", "reason"],
  },
};

const snackDetailsSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING },
        classification: { type: Type.STRING, enum: ["Healthy", "Unhealthy"] },
        reason: { type: Type.STRING },
        photoPrompt: { type: Type.STRING, description: 'A brief, vivid DALL-E style prompt to generate a photo of this snack. e.g. "A glossy, perfectly ripe avocado sliced in half on a marble countertop."' },
        ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
        instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
        nutrition: {
            type: Type.OBJECT,
            properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER },
                fiber: { type: Type.NUMBER },
                sugar: { type: Type.NUMBER }
            },
            required: ["calories", "protein", "carbs", "fat", "fiber", "sugar"]
        },
        alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "If the snack is unhealthy, suggest 1-2 healthier alternatives. Otherwise, empty array." },
        variations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "If the snack is healthy, suggest 1-2 interesting variations. Otherwise, empty array." },
        allergyConflicts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of ingredients that conflict with the user's provided allergies. Check against the user's allergy list." }
    },
    required: ["name", "classification", "reason", "photoPrompt", "ingredients", "instructions", "nutrition", "alternatives", "variations", "allergyConflicts"]
};

const imageClassificationSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: 'The name of the snack in the image.' },
        classification: { type: Type.STRING, enum: ["Healthy", "Unhealthy"], description: 'Classification of the snack.' },
        reason: { type: Type.STRING, description: 'A brief, scientific reason for the classification.' },
    },
    required: ["name", "classification", "reason"],
};

const challengesSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: "A unique kebab-case ID for the challenge, e.g., 'log-5-snacks'." },
            description: { type: Type.STRING, description: "A fun, engaging description of the challenge for the user." },
            goal: { type: Type.NUMBER, description: "The target number for the challenge (e.g., 5 for logging 5 snacks)." },
            reward: { type: Type.NUMBER, description: "The number of SnackCoins awarded upon completion." },
            type: { type: Type.STRING, enum: ['log', 'healthy', 'avoid_unhealthy', 'protein_goal'], description: "The type of challenge for internal tracking."}
        },
        required: ["id", "description", "goal", "reward", "type"]
    }
};
const journalAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        detectedMood: { type: Type.STRING, enum: ["Happy", "Stressed", "Tired", "Neutral", "Sad", "Energetic", "Calm"], description: "The primary mood detected from the user's text." },
        suggestion: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                classification: { type: Type.STRING, enum: ["Healthy"] },
                reason: { type: Type.STRING, description: "Reason why this snack is good for the detected mood." }
            },
            required: ["name", "classification", "reason"]
        }
    },
    required: ["detectedMood", "suggestion"]
};


// API Functions
export const generateSnackSuggestions = async (userProfile: UserProfile, craving: string, activity: string, mood: string): Promise<GeneratedSnack[]> => {
  try {
    const prompt = `
      User Profile:
      - Age: ${userProfile.age}
      - Goals: ${userProfile.goals.join(', ')}
      - Dietary Preferences: ${userProfile.dietaryPreferences.join(', ')}
      - Allergies: ${userProfile.allergies.join(', ') || 'None'}
      - Lifestyle: ${userProfile.activityLevel}
      - Pantry Items: ${userProfile.pantryItems.join(', ')}

      Current Context:
      - Craving: ${craving}
      - Recent/Planned Activity: ${activity}
      - Mood: ${mood}

      Please generate 5 snack ideas based on the user profile and current context. Prioritize using ingredients from the user's pantry. For each snack, provide its name, a classification ('Healthy' or 'Unhealthy'), and a brief reason.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: snackGenerationSchema,
        temperature: 0.7,
      },
    });

    const jsonText = response.text;
    const suggestions = JSON.parse(jsonText) as GeneratedSnack[];
    return suggestions;
  } catch (error) {
    console.error("Error generating snack suggestions:", error);
    throw new Error("Failed to get snack ideas from AI. Please try again.");
  }
};

export const getSnackDetails = async (snackName: string, userProfile: UserProfile): Promise<SnackDetails> => {
    try {
        const prompt = `
        Provide a detailed breakdown for the snack: "${snackName}".

        Consider the user's profile for allergy conflicts:
        - Allergies: ${userProfile.allergies.join(', ') || 'None'}

        Return a full JSON object with all fields from the schema.
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: snackDetailsSchema,
            },
        });
        const jsonText = response.text;
        return JSON.parse(jsonText) as SnackDetails;
    } catch (error) {
        console.error("Error getting snack details:", error);
        throw new Error("Failed to get snack details. Please try again.");
    }
};

export const generateSnackImage = async (prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: `Photorealistic image of ${prompt}, bright, clean, appetizing` }],
            },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                },
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64EncodeString: string = part.inlineData.data;
                return `data:${part.inlineData.mimeType};base64,${base64EncodeString}`;
            }
        }
        return "";
    } catch (error) {
        console.error("Error generating snack image:", error);
        return "";
    }
};

export const getDashboardSuggestion = async (userProfile: UserProfile): Promise<GeneratedSnack> => {
    try {
        const timeOfDay = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";
        const prompt = `
        Based on the user's profile and the current time of day (${timeOfDay}), suggest one single, perfectly-timed healthy snack.

        User Profile:
        - Goals: ${userProfile.goals.join(', ')}
        - Dietary Preferences: ${userProfile.dietaryPreferences.join(', ')}
        - Allergies: ${userProfile.allergies.join(', ') || 'None'}
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      classification: { type: Type.STRING, enum: ["Healthy"] },
                      reason: { type: Type.STRING },
                    },
                    required: ["name", "classification", "reason"],
                }
            },
        });
        const jsonText = response.text;
        return JSON.parse(jsonText) as GeneratedSnack;
    } catch (error) {
        console.error("Error generating dashboard suggestion:", error);
        return { name: "Apple Slices with Peanut Butter", classification: "Healthy", reason: "A balanced mix of fiber and protein for steady energy." };
    }
};

export const classifySnackFromImage = async (base64Image: string, mimeType: string): Promise<ImageClassificationResult> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType: mimeType,
                data: base64Image,
            },
        };
        const textPart = {
            text: "Identify the snack in this image. Is it generally considered healthy or unhealthy? Provide a brief reason for your classification. Respond in JSON format."
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, imagePart] },
             config: {
                responseMimeType: "application/json",
                responseSchema: imageClassificationSchema,
            },
        });

        const jsonText = response.text;
        return JSON.parse(jsonText) as ImageClassificationResult;
    } catch (error) {
        console.error("Error classifying snack image:", error);
        throw new Error("Could not analyze the image. Please try another one.");
    }
};


export const generatePantrySnacks = async (pantryItems: string[], userProfile: UserProfile): Promise<GeneratedSnack[]> => {
    try {
        const prompt = `
        Based *only* on the following pantry ingredients, generate up to 5 snack ideas that fit the user's profile. If no reasonable snacks can be made, return an empty array.
        
        Pantry Ingredients: ${pantryItems.join(', ')}

        User Profile:
        - Goals: ${userProfile.goals.join(', ')}
        - Dietary Preferences: ${userProfile.dietaryPreferences.join(', ')}
        - Allergies: ${userProfile.allergies.join(', ') || 'None'}
        `;
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: snackGenerationSchema,
            },
        });
        const jsonText = response.text;
        return JSON.parse(jsonText) as GeneratedSnack[];
    } catch (error) {
        console.error("Error generating pantry snacks:", error);
        throw new Error("Could not generate snacks from your pantry items.");
    }
};

export const generateWeeklyChallenges = async (userProfile: UserProfile): Promise<Omit<Challenge, 'progress' | 'isCompleted'>[]> => {
     try {
        const prompt = `
        Generate 3 diverse and personalized weekly wellness challenges for the following user. The challenges should be actionable and relate to their goals.

        User Profile:
        - Goals: ${userProfile.goals.join(', ')}
        - Recent Activity: (Assume moderately active)
        `;
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: challengesSchema,
            },
        });
        const jsonText = response.text;
        return JSON.parse(jsonText) as Omit<Challenge, 'progress' | 'isCompleted'>[];
    } catch (error) {
        console.error("Error generating challenges:", error);
        // Return fallback challenges
        return [
            { id: 'log-5-snacks', description: 'Log any 5 snacks this week', goal: 5, reward: 50, type: 'log' },
            { id: 'log-3-healthy', description: 'Eat 3 healthy snacks', goal: 3, reward: 75, type: 'healthy' },
        ];
    }
};


export const analyzeJournalEntry = async (text: string, userProfile: UserProfile): Promise<Omit<JournalEntry, 'id' | 'timestamp' | 'text'>> => {
    try {
        const prompt = `
        Analyze the following user journal entry for its primary mood. Then, suggest a single, simple, and healthy snack that would be comforting or helpful for that mood. Consider the user's goals.

        User Journal Entry: "${text}"

        User Profile:
        - Goals: ${userProfile.goals.join(', ')}
        `;
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: journalAnalysisSchema,
            },
        });
        const jsonText = response.text;
        return JSON.parse(jsonText) as Omit<JournalEntry, 'id' | 'timestamp' | 'text'>;
    } catch (error) {
        console.error("Error analyzing journal entry:", error);
        throw new Error("Could not analyze your journal entry at this time.");
    }
};