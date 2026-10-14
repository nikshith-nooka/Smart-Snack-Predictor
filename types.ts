
export type DietaryPreference = "None" | "Vegetarian" | "Vegan" | "Gluten-Free" | "Keto";
export type ActivityLevel = "Sedentary" | "Lightly Active" | "Moderately Active" | "Very Active";
export type Goal = "Lose Weight" | "Maintain Weight" | "Gain Muscle" | "Eat Healthier";
export type Mood = "Happy" | "Stressed" | "Tired" | "Neutral" | "Sad" | "Energetic" | "Calm";

export interface Challenge {
  id: string;
  description: string;
  goal: number;
  progress: number;
  reward: number;
  isCompleted: boolean;
  type: 'log' | 'healthy' | 'avoid_unhealthy' | 'protein_goal';
}

export interface UserProfile {
  name: string;
  age: number;
  height: number; // in cm
  weight: number; // in kg
  dietaryPreferences: DietaryPreference[];
  allergies: string[];
  activityLevel: ActivityLevel;
  goals: Goal[];
  pantryItems: string[];
  challenges: Challenge[];
}

export type SnackClassification = "Healthy" | "Unhealthy";

export interface GeneratedSnack {
  name: string;
  classification: SnackClassification;
  reason: string;
}

export interface ImageClassificationResult {
  name: string;
  classification: SnackClassification;
  reason: string;
}

export interface Nutrition {
  calories: number;
  protein: number; // in grams
  carbs: number; // in grams
  fat: number; // in grams
  fiber: number; // in grams
  sugar: number; // in grams;
}

export interface SnackDetails extends GeneratedSnack {
  photoPrompt?: string;
  imageUrl?: string;
  ingredients: string[];
  instructions: string[];
  nutrition: Nutrition;
  alternatives: string[];
  variations: string[];
  allergyConflicts: string[];
}

export interface LoggedSnack {
  id: string;
  snack: SnackDetails;
  timestamp: string;
  mood: Mood;
  satisfaction: number; // 1-5
}

export interface JournalEntry {
    id: string;
    text: string;
    detectedMood: Mood;
    suggestion: GeneratedSnack;
    timestamp: string;
}
