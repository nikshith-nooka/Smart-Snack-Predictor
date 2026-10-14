import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import type { UserProfile, LoggedSnack, SnackDetails, Challenge, JournalEntry } from '../types';
import { generateWeeklyChallenges } from '../services/geminiService';

// --- THEME CONTEXT ---
type Theme = 'light' | 'dark';
type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

// --- USER CONTEXT ---
type UserContextType = {
  profile: UserProfile | null;
  loggedSnacks: LoggedSnack[];
  snackCoins: number;
  streak: number;
  challenges: Challenge[];
  journalEntries: JournalEntry[];
  setProfile: (profile: UserProfile) => void;
  logSnack: (snack: SnackDetails, mood: LoggedSnack['mood'], satisfaction: number) => void;
  updatePantry: (items: string[]) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  fetchChallenges: () => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};

// Helper for local storage
const getStorageItem = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading ${key} from localStorage`, error);
    return defaultValue;
  }
};

const setStorageItem = <T,>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error saving ${key} to localStorage`, error);
  }
};

// --- APP PROVIDER (combines Theme and User) ---
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme State
  const [theme, setTheme] = useState<Theme>(() => getStorageItem('theme', 'light'));

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'light' ? 'dark' : 'light');
    root.classList.add(theme);
    setStorageItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // User State - Initialize from storage
  const [profile, setProfileState] = useState<UserProfile | null>(() => getStorageItem('profile', null));
  const [loggedSnacks, setLoggedSnacks] = useState<LoggedSnack[]>(() => getStorageItem('loggedSnacks', []));
  const [snackCoins, setSnackCoins] = useState<number>(() => getStorageItem('snackCoins', 0));
  const [streak, setStreak] = useState<number>(() => getStorageItem('streak', 0));
  const [challenges, setChallenges] = useState<Challenge[]>(() => getStorageItem('challenges', []));
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() => getStorageItem('journalEntries', []));

  // Persistence Effects
  useEffect(() => setStorageItem('profile', profile), [profile]);
  useEffect(() => setStorageItem('loggedSnacks', loggedSnacks), [loggedSnacks]);
  useEffect(() => setStorageItem('snackCoins', snackCoins), [snackCoins]);
  useEffect(() => setStorageItem('streak', streak), [streak]);
  useEffect(() => setStorageItem('challenges', challenges), [challenges]);
  useEffect(() => setStorageItem('journalEntries', journalEntries), [journalEntries]);

  const setProfile = (newProfile: UserProfile) => {
    setProfileState(newProfile);
  };

  const updateChallengeProgress = useCallback((updatedChallenges: Challenge[], newSnack: SnackDetails) => {
      let coinsToAdd = 0;
      const newChallenges = updatedChallenges.map(c => {
          if (c.isCompleted) return c;

          let progressMade = false;
          if (c.type === 'log') {
              c.progress += 1;
              progressMade = true;
          } else if (c.type === 'healthy' && newSnack.classification === 'Healthy') {
              c.progress += 1;
              progressMade = true;
          } else if (c.type === 'avoid_unhealthy' && newSnack.classification === 'Healthy') {
               c.progress += 1;
               progressMade = true;
          }
          // Add more types here e.g. protein goal

          if (progressMade && c.progress >= c.goal) {
              c.isCompleted = true;
              coinsToAdd += c.reward;
          }
          return c;
      });
      if (coinsToAdd > 0) {
        setSnackCoins(c => c + coinsToAdd);
      }
      setChallenges(newChallenges);
  }, []);

  const logSnack = useCallback((snack: SnackDetails, mood: LoggedSnack['mood'], satisfaction: number) => {
    const newLog: LoggedSnack = {
      id: new Date().toISOString(),
      snack,
      timestamp: new Date().toISOString(),
      mood,
      satisfaction
    };
    setLoggedSnacks(prev => [newLog, ...prev]);

    if (snack.classification === 'Healthy') {
        setSnackCoins(c => c + 10);
        setStreak(s => s + 1);
    } else {
        setStreak(0); // Reset streak for unhealthy snacks
    }

    // Update challenges
    updateChallengeProgress(challenges, snack);

  }, [challenges, updateChallengeProgress]);
  
  const updatePantry = useCallback((items: string[]) => {
      setProfileState(prev => prev ? {...prev, pantryItems: items} : null);
  }, []);
  
  const addJournalEntry = useCallback((entry: JournalEntry) => {
      setJournalEntries(prev => [entry, ...prev]);
  }, []);

  const fetchChallenges = useCallback(async () => {
    if (profile && challenges.length === 0) { // Only fetch if no challenges exist
        const fetched = await generateWeeklyChallenges(profile);
        const newChallenges: Challenge[] = fetched.map(c => ({
            ...c,
            progress: 0,
            isCompleted: false
        }));
        setChallenges(newChallenges);
    }
  }, [profile, challenges.length]);


  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <UserContext.Provider value={{ 
          profile, 
          loggedSnacks, 
          snackCoins, 
          streak, 
          challenges,
          journalEntries,
          setProfile, 
          logSnack,
          updatePantry,
          addJournalEntry,
          fetchChallenges
      }}>
        {children}
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
};