import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useTheme, useUser } from '../contexts/AppContext';
import { SunIcon, MoonIcon, CheckCircle2Icon, AlertTriangleIcon, SparklesIcon, ChevronRightIcon, PlusIcon, HeartIcon, AppleIcon, CameraIcon, PackageIcon, TrophyIcon, MicIcon, Trash2Icon, HomeIcon, BookOpenIcon, BarChartIcon, SettingsIcon, ChevronLeftIcon } from '../constants';
import { generateSnackSuggestions, getSnackDetails, generateSnackImage, getDashboardSuggestion, classifySnackFromImage, generatePantrySnacks, analyzeJournalEntry } from '../services/geminiService';
import type { UserProfile, DietaryPreference, ActivityLevel, Goal, GeneratedSnack, SnackDetails, LoggedSnack, Mood, ImageClassificationResult, Challenge, JournalEntry } from '../types';
import { ResponsiveContainer, BarChart, LineChart, PieChart, Bar, Line, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Check for Web Speech API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if(recognition) {
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
}

// =================================================================================
// REUSABLE UI COMPONENTS
// =================================================================================

const Button: React.FC<{
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  type?: 'button' | 'submit';
  disabled?: boolean;
}> = ({ onClick, children, className = '', variant = 'primary', type = 'button', disabled }) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none px-5 py-2.5 shadow-sm hover:scale-[1.03] active:scale-[0.98]';
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary',
    ghost: 'shadow-none hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</button>;
};

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void; }> = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`rounded-2xl border border-black/5 bg-card/60 text-card-foreground shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:shadow-black/10 ${onClick ? 'cursor-pointer transition-transform duration-300 hover:scale-[1.02]' : ''} ${className}`}>
    {children}
  </div>
);

const Spinner: React.FC<{ className?: string }> = ({ className = "h-8 w-8" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${className} animate-spin text-primary dark:text-primary-dark`}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();
    return (
        <Button onClick={toggleTheme} variant="ghost" className="p-2 rounded-full !shadow-none">
            {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
        </Button>
    );
};

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
    <Card className="p-4 bg-destructive/10 border-destructive/20 mt-4">
        <div className="flex items-center gap-3">
            <AlertTriangleIcon className="h-6 w-6 text-destructive"/>
            <p className="font-semibold text-destructive">{message}</p>
        </div>
    </Card>
);

const PageTitle: React.FC<{ title: string, subtitle: string, icon: React.ReactNode }> = ({ title, subtitle, icon }) => (
    <div className="flex items-center gap-4 mb-8">
        <div className="grid place-items-center h-12 w-12 rounded-lg bg-primary/10 dark:bg-primary-dark/20 text-primary dark:text-primary-dark">
            {icon}
        </div>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
        </div>
    </div>
);

const BackButton: React.FC<{ to?: string | number; text?: string }> = ({ to = -1, text = 'Back' }) => {
    const navigate = useNavigate();
    return (
        <Button 
            variant="ghost" 
            onClick={() => {
                if (typeof to === 'number') {
                    navigate(to);
                } else {
                    navigate(to);
                }
            }} 
            className="!p-2 mb-4 -ml-2 text-muted-foreground hover:text-foreground !shadow-none !justify-start"
        >
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            {text}
        </Button>
    );
};

// =================================================================================
// HELPER COMPONENTS
// =================================================================================

const SnackCard: React.FC<{ snack: GeneratedSnack; onClick?: () => void; className?: string }> = ({ snack, onClick, className }) => {
  const isHealthy = snack.classification === 'Healthy';
  return (
    <Card className={`p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl dark:hover:shadow-primary/10 ${onClick ? 'cursor-pointer' : ''} ${className}`} onClick={onClick}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex-shrink-0 grid place-items-center rounded-full h-10 w-10 ${isHealthy ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
            {isHealthy ? <CheckCircle2Icon className="h-6 w-6 text-green-500" /> : <AlertTriangleIcon className="h-6 w-6 text-amber-500" />}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base">{snack.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">{snack.reason}</p>
        </div>
        {onClick && <ChevronRightIcon className="h-5 w-5 text-muted-foreground self-center" />}
      </div>
    </Card>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; unit?: string }> = ({ title, value, icon, unit }) => (
    <Card className="p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-muted-foreground">
            <h3 className="font-semibold text-sm">{title}</h3>
            {icon}
        </div>
        <div>
            <span className="text-3xl font-bold text-foreground">{value}</span>
            {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
        </div>
    </Card>
);

const SkeletonLoader: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`bg-muted/50 animate-pulse rounded-lg ${className}`}></div>
);

// =================================================================================
// PAGE COMPONENTS
// =================================================================================

export const LandingPage = () => {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <div className="absolute top-4 right-4"><ThemeToggle /></div>
            <AppleIcon className="h-20 w-20 text-primary dark:text-primary-dark mb-4" />
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-pink-500">
                Smart Snack Predictor
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                Your AI-powered nutritionist. Get personalized, healthy snack recommendations based on your goals, cravings, and even what's in your pantry.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button onClick={() => navigate('/onboarding')} className="animate-pulse-glow">
                    Get Started <ChevronRightIcon className="ml-2 h-4 w-4" />
                </Button>
                <Button onClick={() => navigate('/dashboard')} variant="secondary">
                    I have a profile
                </Button>
            </div>
        </div>
    );
};

const ProfileForm: React.FC<{
    initialData: Partial<UserProfile>;
    onSubmit: (data: UserProfile) => void;
    submitText: string;
}> = ({ initialData, onSubmit, submitText }) => {
    const [formData, setFormData] = useState<Partial<UserProfile>>(initialData);
    const [message, setMessage] = useState('');


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData as UserProfile);
        setMessage('Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: e.target.type === 'number' ? Number(value) || 0 : value });
    };

    const toggleMultiSelect = (field: 'dietaryPreferences' | 'goals', value: any) => {
        const current = formData[field] as string[] || [];
        const newValues = current.includes(value)
            ? current.filter(item => item !== value)
            : [...current, value];
        setFormData({ ...formData, [field]: newValues });
    };

    const inputClasses = "w-full p-2 border rounded-md bg-muted border-muted-foreground/20 focus:ring-2 focus:ring-primary focus:border-primary transition-all";
    const dietaryPreferenceOptions: DietaryPreference[] = ["None", "Vegetarian", "Vegan", "Gluten-Free", "Keto"];
    const activityLevelOptions: ActivityLevel[] = ["Sedentary", "Lightly Active", "Moderately Active", "Very Active"];
    const goalOptions: Goal[] = ['Lose Weight', 'Maintain Weight', 'Gain Muscle', 'Eat Healthier'];

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">Full Name</label>
                <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} className={inputClasses} required />
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label htmlFor="age" className="block text-sm font-medium mb-1">Age</label>
                    <input type="number" name="age" id="age" value={formData.age} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label htmlFor="height" className="block text-sm font-medium mb-1">Height (cm)</label>
                    <input type="number" name="height" id="height" value={formData.height} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label htmlFor="weight" className="block text-sm font-medium mb-1">Weight (kg)</label>
                    <input type="number" name="weight" id="weight" value={formData.weight} onChange={handleChange} className={inputClasses} />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium mb-2">Goals</label>
                <div className="flex flex-wrap gap-2">
                    {goalOptions.map(goal => (
                        <Button key={goal} type="button" variant={(formData.goals || []).includes(goal) ? 'primary' : 'secondary'} onClick={() => toggleMultiSelect('goals', goal)}>{goal}</Button>
                    ))}
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium mb-2">Dietary Preferences</label>
                <div className="flex flex-wrap gap-2">
                    {dietaryPreferenceOptions.map(pref => (
                        <Button key={pref} type="button" variant={(formData.dietaryPreferences || []).includes(pref) ? 'primary' : 'secondary'} onClick={() => toggleMultiSelect('dietaryPreferences', pref)}>{pref}</Button>
                    ))}
                </div>
            </div>
            <div>
                <label htmlFor="activityLevel" className="block text-sm font-medium mb-1">Activity Level</label>
                <select name="activityLevel" id="activityLevel" value={formData.activityLevel} onChange={handleChange} className={inputClasses}>
                    {activityLevelOptions.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="allergies" className="block text-sm font-medium mb-1">Allergies (comma-separated)</label>
                <input type="text" name="allergies" id="allergies" value={(formData.allergies || []).join(', ')} onChange={(e) => setFormData({ ...formData, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className={inputClasses} placeholder="e.g., Peanuts, Shellfish" />
            </div>
            
            <div className="flex items-center gap-4">
                 <Button type="submit" className="w-full !py-3">{submitText}</Button>
                 {message && <span className="text-sm text-green-600 animate-fade-in">{message}</span>}
            </div>
        </form>
    );
};


export const OnboardingPage = () => {
    const { setProfile, profile } = useUser();
    const navigate = useNavigate();
    
    useEffect(() => {
        if(profile) navigate('/dashboard');
    }, [profile, navigate]);
    
    const initialData: Partial<UserProfile> = {
        name: '', age: 18, height: 170, weight: 65,
        dietaryPreferences: [], allergies: [],
        activityLevel: 'Moderately Active', goals: [],
        pantryItems: [], challenges: [],
    };
    
    const handleOnboard = (data: UserProfile) => {
        setProfile(data);
        navigate('/dashboard');
    }

    return (
        <div className="max-w-xl mx-auto py-8 animate-slide-in-up">
            <BackButton to="/" text="Back to Home"/>
            <PageTitle title="Create Your Profile" subtitle="Let's get to know you to personalize your experience." icon={<AppleIcon className="h-6 w-6"/>} />
            <ProfileForm initialData={initialData} onSubmit={handleOnboard} submitText="Complete Profile" />
        </div>
    );
};

export const DashboardPage = () => {
    const { profile, loggedSnacks, snackCoins, streak, fetchChallenges, challenges } = useUser();
    const navigate = useNavigate();
    const [suggestion, setSuggestion] = useState<GeneratedSnack | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            getDashboardSuggestion(profile)
                .then(setSuggestion)
                .catch(err => console.error("Failed dashboard suggestion", err))
                .finally(() => setLoading(false));
            if(challenges.length === 0) fetchChallenges();
        }
    }, [profile, fetchChallenges, challenges.length]);
    
    if (!profile) return <div className="p-4 flex justify-center"><Spinner /></div>;

    const totalCaloriesToday = useMemo(() => {
        const today = new Date().toDateString();
        return loggedSnacks
            .filter(log => new Date(log.timestamp).toDateString() === today)
            .reduce((acc, log) => acc + log.snack.nutrition.calories, 0)
    }, [loggedSnacks]);
    const dailyGoal = 2200; // Example daily goal

    const activeChallenge = challenges.find(c => !c.isCompleted);

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-4xl font-bold tracking-tight">Hello, {profile.name.split(' ')[0]}!</h1>
                <p className="text-muted-foreground">Ready to snack smart today?</p>
            </div>
            
            <Card className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                <div className="flex items-center gap-3 mb-2">
                    <SparklesIcon className="h-6 w-6 text-primary dark:text-primary-dark"/>
                    <h2 className="text-xl font-semibold">Your Smart Suggestion</h2>
                </div>
                {loading ? <div className="flex justify-center p-4"><Spinner /></div> : suggestion && <SnackCard snack={suggestion} onClick={() => navigate(`/snack/${encodeURIComponent(suggestion.name)}`)} />}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Calories Today" value={totalCaloriesToday.toString()} unit={`/ ${dailyGoal} kcal`} icon={<HeartIcon className="h-5 w-5"/>} />
                <StatCard title="SnackCoins" value={snackCoins.toString()} icon={<AppleIcon className="h-5 w-5"/>} />
                <StatCard title="Healthy Streak" value={streak.toString()} unit="days" icon={<CheckCircle2Icon className="h-5 w-5"/>} />
            </div>

             {activeChallenge && (
                <div>
                    <h2 className="text-xl font-semibold mb-3">Active Challenge</h2>
                    <Card className="p-4" onClick={() => navigate('/challenges')}>
                        <div className="flex items-center gap-4">
                            <TrophyIcon className="h-8 w-8 text-amber-500" />
                            <div className="flex-1">
                                <p className="font-semibold">{activeChallenge.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-full bg-muted rounded-full h-2.5">
                                        <div className="bg-primary dark:bg-primary-dark h-2.5 rounded-full" style={{ width: `${(activeChallenge.progress / activeChallenge.goal) * 100}%` }}></div>
                                    </div>
                                    <span className="text-xs font-mono text-muted-foreground">{activeChallenge.progress}/{activeChallenge.goal}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export const GeneratorPage = () => {
    const { profile } = useUser();
    const navigate = useNavigate();
    const [craving, setCraving] = useState('');
    const [activity, setActivity] = useState('');
    const [mood, setMood] = useState<Mood | ''>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [results, setResults] = useState<GeneratedSnack[]>([]);
    
    const moods: Mood[] = ["Happy", "Stressed", "Tired", "Neutral", "Sad", "Energetic", "Calm"];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setLoading(true);
        setError('');
        setResults([]);
        try {
            const suggestions = await generateSnackSuggestions(profile, craving, activity, mood || "any");
            setResults(suggestions);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <BackButton />
            <PageTitle title="Snack Generator" subtitle="Get personalized ideas for right now" icon={<SparklesIcon className="h-6 w-6"/>} />
            <form onSubmit={handleSubmit}>
                <Card className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">What are you craving?</label>
                        <input type="text" value={craving} onChange={(e) => setCraving(e.target.value)} placeholder="e.g., something salty, sweet, or crunchy" className="w-full p-2 border rounded-md bg-muted" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Any recent or planned activity?</label>
                        <input type="text" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="e.g., Post-workout, movie night, long study session" className="w-full p-2 border rounded-md bg-muted" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-2">How are you feeling?</label>
                        <div className="flex flex-wrap gap-2">
                             {moods.map(m => (
                                 <Button key={m} type="button" variant={mood === m ? 'primary' : 'secondary'} onClick={() => setMood(m)}>{m}</Button>
                            ))}
                        </div>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full !py-3">
                        {loading ? <Spinner className="h-5 w-5"/> : 'Generate Snacks'}
                    </Button>
                </Card>
            </form>
            
            {error && <ErrorDisplay message={error} />}

            {results.length > 0 && (
                <div className="mt-8 animate-slide-in-up">
                    <h2 className="text-2xl font-bold mb-4">Here are some ideas...</h2>
                    <div className="space-y-4">
                        {results.map((snack, i) => (
                             <SnackCard key={i} snack={snack} onClick={() => navigate(`/snack/${encodeURIComponent(snack.name)}`)} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const SnackDetailPage = () => {
    const { snackName } = useParams<{ snackName: string }>();
    const { profile, logSnack } = useUser();
    const navigate = useNavigate();
    const [details, setDetails] = useState<SnackDetails | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [isLogging, setIsLogging] = useState(false);
    const [satisfaction, setSatisfaction] = useState(3);
    const [mood, setMood] = useState<Mood>('Neutral');
    const moods: Mood[] = ["Happy", "Stressed", "Tired", "Neutral", "Sad", "Energetic", "Calm"];

    useEffect(() => {
        if (!snackName || !profile) return;
        setLoading(true);
        setError('');
        setImageUrl(null);
        getSnackDetails(decodeURIComponent(snackName), profile)
            .then(data => {
                setDetails(data);
                if (data.photoPrompt) {
                    setImageLoading(true);
                    generateSnackImage(data.photoPrompt)
                        .then(url => setImageUrl(url))
                        .finally(() => setImageLoading(false));
                }
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [snackName, profile]);
    
    const handleLogSnack = () => {
        if (!details) return;
        logSnack(details, mood, satisfaction);
        setIsLogging(false);
        navigate('/log');
    };

    if (loading) {
        return (
            <div>
                <BackButton />
                <div className="space-y-6">
                    <SkeletonLoader className="h-10 w-3/4" />
                    <SkeletonLoader className="h-64 w-full" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SkeletonLoader className="h-48 w-full" />
                        <SkeletonLoader className="h-48 w-full" />
                    </div>
                </div>
            </div>
        );
    }
    
    if (error) return <div><BackButton/><ErrorDisplay message={error} /></div>;
    if (!details) return <div><BackButton/>Snack not found.</div>;

    const nutritionData = [
        { name: 'Protein', value: details.nutrition.protein },
        { name: 'Carbs', value: details.nutrition.carbs },
        { name: 'Fat', value: details.nutrition.fat },
    ];
    const COLORS = ['#8884d8', '#82ca9d', '#ffc658'];

    return (
        <div className="animate-fade-in">
            <BackButton />
            <div className="space-y-6">
                <div>
                     <h1 className="text-4xl font-bold tracking-tight">{details.name}</h1>
                     <div className="flex items-center gap-2 mt-2">
                        {details.classification === 'Healthy' ? <CheckCircle2Icon className="h-5 w-5 text-green-500"/> : <AlertTriangleIcon className="h-5 w-5 text-amber-500"/>}
                        <span className={`font-semibold ${details.classification === 'Healthy' ? 'text-green-500' : 'text-amber-500'}`}>{details.classification}</span>
                     </div>
                     <p className="text-muted-foreground mt-1">{details.reason}</p>
                </div>
                
                <Card className="p-4 flex justify-center bg-muted/20">
                    {imageLoading ? (
                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <Spinner />
                            <span className="text-sm">Generating AI photo...</span>
                        </div>
                    ) : imageUrl ? (
                        <img src={imageUrl} alt={details.name} className="w-full h-auto max-h-96 object-contain rounded-lg shadow-sm"/>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-lg w-full">
                            <AppleIcon className="h-16 w-16 opacity-20 mb-2"/>
                            <span>No image available</span>
                        </div>
                    )}
                </Card>

                {details.allergyConflicts.length > 0 && (
                    <Card className="p-4 bg-destructive/10 border-destructive/20">
                        <div className="flex items-center gap-3">
                            <AlertTriangleIcon className="h-6 w-6 text-destructive"/>
                            <div>
                                <h3 className="font-semibold text-destructive">Potential Allergy Alert</h3>
                                <p className="text-sm text-destructive/80">Conflicts with your profile allergies: {details.allergyConflicts.join(', ')}</p>
                            </div>
                        </div>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Card className="p-6">
                        <h3 className="text-xl font-bold mb-3">Ingredients</h3>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            {details.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                        </ul>
                    </Card>
                    <Card className="p-6">
                        <h3 className="text-xl font-bold mb-3">Instructions</h3>
                        <ol className="list-decimal list-inside space-y-2">
                            {details.instructions.map((step, i) => <li key={i}>{step}</li>)}
                        </ol>
                    </Card>
                     <Card className="p-6">
                        <h3 className="text-xl font-bold mb-3">Nutrition Facts</h3>
                        <p className="text-muted-foreground mb-4">Calories: <span className="font-bold text-foreground">{details.nutrition.calories}</span></p>
                        <ResponsiveContainer width="100%" height={150}>
                            <PieChart>
                                <Pie data={nutritionData} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {nutritionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value, name) => [`${value}g`, name]} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                    <Card className="p-6">
                        <h3 className="text-xl font-bold mb-3">{details.classification === 'Healthy' ? 'Variations' : 'Healthier Alternatives'}</h3>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            {(details.classification === 'Healthy' ? details.variations : details.alternatives).map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </Card>
                </div>
                
                {!isLogging ? (
                    <Button onClick={() => setIsLogging(true)} className="w-full !py-3">Log This Snack</Button>
                ) : (
                    <Card className="p-6 animate-slide-in-up">
                        <h3 className="text-xl font-bold mb-4">Log Your Snack</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">How do you feel?</label>
                                 <div className="flex flex-wrap gap-2">
                                    {moods.map(m => (
                                        <Button key={m} type="button" variant={mood === m ? 'primary' : 'secondary'} onClick={() => setMood(m)}>{m}</Button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Satisfaction (1-5)</label>
                                <div className="flex items-center gap-2">
                                    <span>😕</span>
                                    <input type="range" min="1" max="5" value={satisfaction} onChange={e => setSatisfaction(parseInt(e.target.value))} className="w-full"/>
                                    <span>😋</span>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <Button onClick={() => setIsLogging(false)} variant="secondary" className="w-full">Cancel</Button>
                                <Button onClick={handleLogSnack} className="w-full">Confirm Log</Button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

export const LogPage = () => {
    const { loggedSnacks } = useUser();
    const navigate = useNavigate();

    return (
        <div>
            <BackButton />
            <PageTitle title="Snack Log" subtitle="Your snacking history" icon={<BookOpenIcon className="h-6 w-6"/>} />
            <div className="space-y-4">
                {loggedSnacks.length > 0 ? loggedSnacks.map(log => (
                    <Card key={log.id} className="p-4 cursor-pointer" onClick={() => navigate(`/snack/${encodeURIComponent(log.snack.name)}`)}>
                        <div className="flex justify-between items-start gap-4">
                           <div className="flex-1">
                                <h3 className="font-bold">{log.snack.name}</h3>
                                <p className="text-sm text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</p>
                           </div>
                           <div className="text-right">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${log.snack.classification === 'Healthy' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                                    {log.snack.classification}
                                </span>
                                <p className="text-sm text-muted-foreground mt-1">Mood: {log.mood}</p>
                           </div>
                        </div>
                    </Card>
                )) : (
                     <Card className="p-8 text-center border-dashed">
                        <p className="text-muted-foreground">You haven't logged any snacks yet.</p>
                        <Button onClick={() => navigate('/generator')} className="mt-4">Find a snack to log</Button>
                    </Card>
                )}
            </div>
        </div>
    );
};

export const AnalyticsPage = () => {
    const { loggedSnacks } = useUser();

    const chartData = useMemo(() => {
        const healthData = loggedSnacks.reduce((acc, log) => {
            acc[log.snack.classification] = (acc[log.snack.classification] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const moodData = loggedSnacks.reduce((acc, log) => {
            acc[log.mood] = (acc[log.mood] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const timeData = loggedSnacks
            .map(log => ({ ...log, date: new Date(log.timestamp).toLocaleDateString() }))
            .reduce((acc, log) => {
                const entry = acc.find(d => d.date === log.date);
                if (entry) {
                    entry.count++;
                    entry.calories += log.snack.nutrition.calories;
                } else {
                    acc.push({ date: log.date, count: 1, calories: log.snack.nutrition.calories });
                }
                return acc;
            }, [] as { date: string; count: number; calories: number }[]).reverse();
        
        return {
            health: Object.entries(healthData).map(([name, value]) => ({ name, value })),
            moods: Object.entries(moodData).map(([name, value]) => ({ name, value })),
            timeline: timeData
        };
    }, [loggedSnacks]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div>
            <BackButton />
            <PageTitle title="Your Analytics" subtitle="Insights into your snacking habits" icon={<BarChartIcon className="h-6 w-6"/>} />
             {loggedSnacks.length === 0 ? (
                 <Card className="p-8 text-center border-dashed">
                    <p className="text-muted-foreground">Not enough data to show analytics.</p>
                    <p className="text-sm text-muted-foreground">Log some snacks to see your stats!</p>
                </Card>
             ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="p-6">
                        <h3 className="text-xl font-bold mb-4">Health Breakdown</h3>
                        <ResponsiveContainer width="100%" height={250}>
                             <PieChart>
                                <Pie data={chartData.health} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                     {chartData.health.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.name === 'Healthy' ? COLORS[1] : COLORS[3]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                    <Card className="p-6">
                        <h3 className="text-xl font-bold mb-4">Moods at Snack Time</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={chartData.moods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {chartData.moods.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                    <Card className="p-6 lg:col-span-2">
                        <h3 className="text-xl font-bold mb-4">Snack Timeline</h3>
                         <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartData.timeline}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis yAxisId="left" stroke="#8884d8" />
                                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                <Tooltip />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="count" name="Snacks" stroke="#8884d8" activeDot={{ r: 8 }} />
                                <Line yAxisId="right" type="monotone" dataKey="calories" name="Calories" stroke="#82ca9d" />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                </div>
             )}
        </div>
    );
};


const CameraView: React.FC<{ onCapture: (dataUrl: string) => void; onClose: () => void }> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        
        const startCamera = async () => {
            try {
                const constraints = { video: { facingMode: { exact: "environment" } } };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                 if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                console.warn("Rear camera not found, trying default camera");
                try {
                    const fallbackConstraints = { video: true };
                    stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                    if (videoRef.current) videoRef.current.srcObject = stream;
                } catch (finalErr) {
                    console.error("Error accessing camera:", finalErr);
                    onClose();
                }
            }
        };

        startCamera();

        return () => {
            stream?.getTracks().forEach(track => track.stop());
        };
    }, [onClose]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);
                const dataUrl = canvasRef.current.toDataURL('image/jpeg');
                onCapture(dataUrl);
            }
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 animate-fade-in">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent flex justify-center gap-4">
                <Button onClick={handleCapture} className="!rounded-full h-16 w-16 !p-0 border-4 border-white bg-primary/50 flex items-center justify-center">
                    <CameraIcon className="h-8 w-8 text-white" />
                </Button>
                 <Button onClick={onClose} variant="secondary" className="absolute right-4 bottom-8">Cancel</Button>
            </div>
        </div>
    );
};

export const ImageClassifierPage = () => {
    const [image, setImage] = useState<{ src: string, file: File } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImageClassificationResult | null>(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const [showCamera, setShowCamera] = useState(false);
    
    const fileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };
    
    const handleFileSelect = async (selectedFile: File) => {
        if (selectedFile && selectedFile.type.startsWith('image/')) {
            const src = await fileToDataUrl(selectedFile);
            setImage({ src, file: selectedFile });
            setResult(null);
            setError('');
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleAnalyze = async () => {
        if (!image) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const base64Image = image.src.split(',')[1];
            const mimeType = image.file.type;
            const res = await classifySnackFromImage(base64Image, mimeType);
            setResult(res);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleCameraCapture = async (dataUrl: string) => {
        setShowCamera(false);
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        handleFileSelect(new File([blob], "capture.jpg", { type: "image/jpeg" }));
    }

    return (
        <div>
            <BackButton />
            <PageTitle title="Scan a Snack" subtitle="Use your camera or upload an image" icon={<CameraIcon className="h-6 w-6"/>} />
            
            {showCamera && <CameraView onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}

            <div
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-4 transition-colors duration-300 ${isDragging ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'}`}
            >
                <div className="flex flex-col items-center justify-center min-h-[250px] text-center">
                    {image ? (
                        <img src={image.src} alt="Uploaded snack" className="max-h-64 object-contain rounded-lg" />
                    ) : (
                        <div className="text-muted-foreground">
                            <CameraIcon className="h-12 w-12 mx-auto mb-2"/>
                            <p className="font-semibold">Drag & drop an image here</p>
                            <p className="text-sm">or click to upload</p>
                        </div>
                    )}
                </div>
                <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    onChange={(e) => {
                        if (e.target.files) handleFileSelect(e.target.files[0]);
                        // Reset input value so same file can be selected again if cleared
                        e.target.value = '';
                    }} 
                    className="hidden" 
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                 <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Upload Image</Button>
                 <Button variant="secondary" onClick={() => setShowCamera(true)}>Use Your Camera</Button>
            </div>
            
            {image && (
                 <div className="mt-4 flex flex-col gap-2">
                    <Button onClick={handleAnalyze} disabled={loading}>
                        {loading ? <Spinner className="h-5 w-5"/> : 'Analyze Snack'}
                    </Button>
                    <Button onClick={() => { setImage(null); setResult(null); }} variant="ghost">Clear Image</Button>
                </div>
            )}

            {error && <ErrorDisplay message={error}/>}
            
            {result && (
                <div className="mt-6 animate-slide-in-up">
                    <h2 className="text-2xl font-bold mb-4">Analysis Result</h2>
                    <SnackCard snack={result} onClick={() => navigate(`/snack/${encodeURIComponent(result.name)}`)}/>
                </div>
            )}
        </div>
    );
};

export const PantryPage = () => {
    const { profile, updatePantry } = useUser();
    const [newItem, setNewItem] = useState('');
    const [results, setResults] = useState<GeneratedSnack[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const pantryItems = profile?.pantryItems || [];

    const handleAddItem = () => {
        if (newItem && !pantryItems.includes(newItem)) {
            updatePantry([...pantryItems, newItem]);
            setNewItem('');
        }
    };

    const handleRemoveItem = (itemToRemove: string) => {
        updatePantry(pantryItems.filter(item => item !== itemToRemove));
    };
    
    const handleGenerate = async () => {
        if (!profile) return;
        setLoading(true);
        setError('');
        setResults([]);
        try {
            const suggestions = await generatePantrySnacks(pantryItems, profile);
            setResults(suggestions);
        } catch(e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <BackButton />
            <PageTitle title="My Pantry" subtitle="Manage your ingredients and get ideas" icon={<PackageIcon className="h-6 w-6"/>} />
            <Card className="p-6">
                 <h3 className="text-xl font-bold mb-3">Add to Pantry</h3>
                 <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                        placeholder="e.g., Almonds, Yogurt, Banana"
                        className="w-full p-2 border rounded-md bg-muted"
                    />
                    <Button onClick={handleAddItem}><PlusIcon className="h-5 w-5"/></Button>
                 </div>
            </Card>

            <div className="mt-6">
                <h3 className="text-xl font-bold mb-3">Your Items</h3>
                <Card className="p-6">
                    {pantryItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {pantryItems.map(item => (
                                <div key={item} className="flex items-center gap-2 bg-secondary rounded-full px-3 py-1">
                                    <span>{item}</span>
                                    <button onClick={() => handleRemoveItem(item)} className="text-muted-foreground hover:text-destructive">
                                        <Trash2Icon className="h-4 w-4"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-muted-foreground">Your pantry is empty. Add some items to get started!</p>}
                </Card>
            </div>
            
            <div className="mt-6">
                <Button onClick={handleGenerate} disabled={loading || pantryItems.length === 0} className="w-full !py-3">
                    {loading ? <Spinner className="h-5 w-5"/> : 'Find Snacks I Can Make'}
                </Button>
            </div>
            
            {error && <ErrorDisplay message={error}/>}

            {results.length > 0 && (
                <div className="mt-8 animate-slide-in-up">
                    <h2 className="text-2xl font-bold mb-4">Ideas from your pantry...</h2>
                    <div className="space-y-4">
                        {results.map((snack, i) => (
                             <SnackCard key={i} snack={snack} onClick={() => navigate(`/snack/${encodeURIComponent(snack.name)}`)} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


export const ChallengesPage = () => {
    const { challenges, fetchChallenges, profile } = useUser();
    
    useEffect(() => {
        if(profile && challenges.length === 0) {
            fetchChallenges();
        }
    }, [profile, challenges, fetchChallenges]);

    const completedChallenges = challenges.filter(c => c.isCompleted);
    const activeChallenges = challenges.filter(c => !c.isCompleted);

    return (
        <div>
            <BackButton />
            <PageTitle title="Weekly Challenges" subtitle="Complete challenges to earn SnackCoins" icon={<TrophyIcon className="h-6 w-6"/>} />
            
            {challenges.length === 0 && (
                <Card className="p-8 text-center border-dashed">
                    <Spinner />
                    <p className="text-muted-foreground mt-2">Generating your weekly challenges...</p>
                </Card>
            )}

            {activeChallenges.length > 0 && (
                 <div className="mb-8">
                    <h2 className="text-2xl font-bold mb-4">Active Challenges</h2>
                    <div className="space-y-4">
                        {activeChallenges.map(c => (
                            <Card key={c.id} className="p-4">
                                <div className="flex items-center gap-4">
                                    <TrophyIcon className="h-8 w-8 text-amber-500" />
                                    <div className="flex-1">
                                        <p className="font-semibold">{c.description}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-full bg-muted rounded-full h-2.5">
                                                <div className="bg-primary dark:bg-primary-dark h-2.5 rounded-full" style={{ width: `${(c.progress / c.goal) * 100}%` }}></div>
                                            </div>
                                            <span className="text-xs font-mono text-muted-foreground">{c.progress}/{c.goal}</span>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-primary dark:text-primary-dark">{c.reward}</p>
                                        <p className="text-xs text-muted-foreground">Coins</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
            
             {completedChallenges.length > 0 && (
                 <div>
                    <h2 className="text-2xl font-bold mb-4">Completed</h2>
                    <div className="space-y-4">
                        {completedChallenges.map(c => (
                            <Card key={c.id} className="p-4 opacity-70">
                                <div className="flex items-center gap-4">
                                    <CheckCircle2Icon className="h-8 w-8 text-green-500" />
                                    <div className="flex-1">
                                        <p className="font-semibold line-through">{c.description}</p>
                                        <p className="text-sm text-muted-foreground">Completed! +{c.reward} coins</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const JournalPage = () => {
    const { profile, addJournalEntry, journalEntries } = useUser();
    const [entry, setEntry] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [analysisResult, setAnalysisResult] = useState<Omit<JournalEntry, 'id' | 'timestamp' | 'text'> | null>(null);
    const navigate = useNavigate();

    const handleMicClick = () => {
        if (!recognition) return;
        if (isListening) {
            recognition.stop();
            setIsListening(false);
        } else {
            recognition.start();
            setIsListening(true);
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setEntry(transcript);
                setIsListening(false);
            };
            recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setError("Speech recognition failed. Please try again or type your entry.");
                setIsListening(false);
            };
        }
    };
    
    const handleSubmit = async () => {
        if (!profile || !entry) return;
        setLoading(true);
        setError('');
        setAnalysisResult(null);
        try {
            const result = await analyzeJournalEntry(entry, profile);
            setAnalysisResult(result);
            addJournalEntry({
                ...result,
                id: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                text: entry
            });
            setEntry('');
        } catch(e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <BackButton />
            <PageTitle title="Daily Journal" subtitle="Log your mood and get a snack suggestion" icon={<MicIcon className="h-6 w-6"/>} />
            <Card className="p-6">
                <h3 className="text-xl font-bold mb-3">How are you feeling today?</h3>
                <div className="relative">
                    <textarea 
                        value={entry}
                        onChange={e => setEntry(e.target.value)}
                        rows={4}
                        placeholder="I'm feeling a bit stressed today because..."
                        className="w-full p-2 pr-12 border rounded-md bg-muted resize-none"
                    />
                    {recognition && (
                         <Button onClick={handleMicClick} variant="ghost" className={`absolute top-2 right-2 !p-2 rounded-full ${isListening ? 'animate-pulse bg-destructive/20' : ''}`}>
                            <MicIcon className={`h-5 w-5 ${isListening ? 'text-destructive' : ''}`}/>
                        </Button>
                    )}
                </div>
                 <Button onClick={handleSubmit} disabled={loading || !entry} className="w-full mt-4">
                    {loading ? <Spinner className="h-5 w-5"/> : 'Analyze My Entry'}
                </Button>
            </Card>

            {error && <ErrorDisplay message={error}/>}

            {analysisResult && (
                <div className="mt-6 animate-slide-in-up">
                    <h2 className="text-2xl font-bold mb-4">Today's Reflection</h2>
                    <Card className="p-6">
                        <p className="text-muted-foreground mb-4">We detected your mood as <span className="font-bold text-primary">{analysisResult.detectedMood}</span>. For a little boost, here's a snack suggestion:</p>
                        <SnackCard snack={analysisResult.suggestion} onClick={() => navigate(`/snack/${encodeURIComponent(analysisResult.suggestion.name)}`)}/>
                    </Card>
                </div>
            )}
            
            {journalEntries.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-4">Past Entries</h2>
                    <div className="space-y-4">
                        {journalEntries.slice(0, 5).map(je => (
                            <Card key={je.id} className="p-4">
                                <p className="text-sm text-muted-foreground font-semibold">{new Date(je.timestamp).toLocaleDateString()}</p>
                                <p className="truncate italic">"{je.text}"</p>
                                <p className="text-sm mt-2">Detected Mood: <span className="font-semibold text-primary">{je.detectedMood}</span></p>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const AppearanceSettings = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <Card className="p-6">
            <h3 className="text-xl font-bold mb-3">Appearance</h3>
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground">Switch between light and dark mode.</p>
                <div className="flex items-center gap-2 bg-secondary rounded-full p-1">
                    <Button onClick={theme === 'dark' ? toggleTheme : undefined} variant={theme === 'light' ? 'primary' : 'ghost'} className="!px-3 !py-1 !rounded-full !shadow-none">Light</Button>
                    <Button onClick={theme === 'light' ? toggleTheme : undefined} variant={theme === 'dark' ? 'primary' : 'ghost'} className="!px-3 !py-1 !rounded-full !shadow-none flex items-center gap-2">
                        Dark <MoonIcon className="h-4 w-4"/>
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export const SettingsPage = () => {
    const { profile, setProfile } = useUser();
    
    if (!profile) return <div className="p-4 flex justify-center"><Spinner /></div>;
    
    return (
        <div>
            <BackButton />
            <PageTitle title="Settings" subtitle="Manage your profile and preferences" icon={<SettingsIcon className="h-6 w-6"/>} />
            <div className="space-y-8">
                <div>
                     <h2 className="text-2xl font-bold mb-4">Your Profile</h2>
                     <Card className="p-6">
                        <ProfileForm initialData={profile} onSubmit={setProfile} submitText="Update Profile" />
                     </Card>
                </div>
                <div>
                     <h2 className="text-2xl font-bold mb-4">Appearance</h2>
                     <AppearanceSettings />
                </div>
            </div>
        </div>
    );
};

export const PageNotFound = () => {
    const { profile } = useUser();
    const navigate = useNavigate();
    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
            <h1 className="text-9xl font-bold text-primary dark:text-primary-dark">404</h1>
            <h2 className="text-3xl font-semibold mt-4">Page Not Found</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
                Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
            </p>
            <Button onClick={() => navigate(profile ? '/dashboard' : '/')} className="mt-8">
                Go to {profile ? 'Dashboard' : 'Home'}
            </Button>
        </div>
    );
};