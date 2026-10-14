import React from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation, Link, Navigate, Outlet } from 'react-router-dom';
import { useUser } from './contexts/AppContext';
import { LandingPage, OnboardingPage, DashboardPage, GeneratorPage, SnackDetailPage, LogPage, AnalyticsPage, SettingsPage, ImageClassifierPage, PantryPage, ChallengesPage, JournalPage, PageNotFound } from './components/AppPages';
import { HomeIcon, SparklesIcon, BookOpenIcon, BarChartIcon, SettingsIcon, AppleIcon, CameraIcon, PackageIcon, TrophyIcon, MicIcon, IconProps } from './constants';

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => (
  <NavLink to={to} className={({ isActive }) => `flex flex-col items-center justify-center text-center flex-shrink-0 w-20 gap-1 p-2 rounded-md text-xs transition-colors ${isActive ? 'bg-primary/10 text-primary dark:text-primary-dark font-semibold' : 'text-muted-foreground hover:bg-accent dark:hover:bg-muted/50'}`}>
    {icon}
    <span>{label}</span>
  </NavLink>
);

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navItems = [
    { to: "/dashboard", icon: <HomeIcon className="h-6 w-6"/>, label: "Home" },
    { to: "/generator", icon: <SparklesIcon className="h-6 w-6"/>, label: "Generate" },
    { to: "/scanner", icon: <CameraIcon className="h-6 w-6"/>, label: "Scan" },
    { to: "/pantry", icon: <PackageIcon className="h-6 w-6"/>, label: "Pantry" },
    { to: "/journal", icon: <MicIcon className="h-6 w-6"/>, label: "Journal" },
    { to: "/log", icon: <BookOpenIcon className="h-6 w-6"/>, label: "Log" },
    { to: "/analytics", icon: <BarChartIcon className="h-6 w-6"/>, label: "Stats" },
    { to: "/challenges", icon: <TrophyIcon className="h-6 w-6"/>, label: "Challenges" },
    { to: "/settings", icon: <SettingsIcon className="h-6 w-6"/>, label: "Settings" },
  ];

  return (
    <div className="bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-24 border-r dark:border-muted flex-col items-center py-6 gap-6 bg-background">
        <Link to="/dashboard" className="flex items-center justify-center">
          <AppleIcon className="h-8 w-8 text-primary dark:text-primary-dark" />
        </Link>
        <nav className="flex flex-col gap-4">
            {navItems.map(item => <NavItem key={item.to} {...item} />)}
        </nav>
      </aside>

      {/* Content Area */}
      <div className="md:pl-24">
          <main className="min-h-screen p-4 md:p-6 pb-24 md:pb-6">
            <div className="container mx-auto max-w-4xl">
                {children}
            </div>
          </main>
      </div>
      
      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm dark:bg-background/80 dark:border-muted md:hidden overflow-x-auto">
        <div className="flex h-16 items-center">
          {navItems.map(item => <NavItem key={item.to} {...item} icon={React.cloneElement(item.icon as React.ReactElement<IconProps>, { className: 'h-5 w-5'})}/>)}
        </div>
      </nav>
    </div>
  );
};

const ProtectedLayout = () => {
    const { profile } = useUser();
    const location = useLocation();

    if (!profile) {
        return <Navigate to="/onboarding" state={{ from: location }} replace />;
    }

    return (
        <MainLayout>
            <Outlet />
        </MainLayout>
    );
};

function App() {
  return (
    <HashRouter>
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            
            <Route element={<ProtectedLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/generator" element={<GeneratorPage />} />
                <Route path="/scanner" element={<ImageClassifierPage />} />
                <Route path="/pantry" element={<PantryPage />} />
                <Route path="/journal" element={<JournalPage />} />
                <Route path="/snack/:snackName" element={<SnackDetailPage />} />
                <Route path="/log" element={<LogPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/challenges" element={<ChallengesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
        </Routes>
    </HashRouter>
  );
}

export default App;
