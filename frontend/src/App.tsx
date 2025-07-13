import { useState, useEffect } from 'react';
import Auth from './pages/Auth';
import Landing from './pages/Landing';
import Homepage from './pages/Homepage';
import Reader from './pages/Reader';

interface UserData {
  username: string;
  normalWpm: number;
  skimmingWpm: number;
  genres: string[];
  themes: string[];
  timestamp: number;
}

function App() {
  const [user, setUser] = useState<string | null>(null);
  const [userWpmData, setUserWpmData] = useState<UserData | null>(null);
  const [currentPage, setCurrentPage] = useState<'auth' | 'landing' | 'homepage' | 'reader'>('auth');
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);

  useEffect(() => {
    const savedData = localStorage.getItem('userWpmData');
    if (savedData) {
      const userData = JSON.parse(savedData) as UserData;
      // Only auto-login if user has complete profile
      if (userData.normalWpm && userData.skimmingWpm && userData.genres && userData.themes) {
        setUser(userData.username);
        setUserWpmData(userData);
        setCurrentPage('homepage');
      }
    }
  }, []);

  const handleAuth = (username: string) => {
    setUser(username);
    
    // Check if user already has complete profile data
    const savedData = localStorage.getItem('userWpmData');
    if (savedData) {
      const userData = JSON.parse(savedData) as UserData;
      if (userData.username === username && userData.normalWpm && userData.skimmingWpm && userData.genres && userData.themes) {
        setUserWpmData(userData);
        setCurrentPage('homepage');
        return;
      }
    }
    
    setCurrentPage('landing');
  };

  const handleWpmComplete = (normalWpm: number, skimmingWpm: number, genres: string[], themes: string[]) => {
    const userData: UserData = {
      username: user!,
      normalWpm,
      skimmingWpm,
      genres,
      themes,
      timestamp: Date.now()
    };
    setUserWpmData(userData);
    setCurrentPage('homepage');
  };

  const handleStartReading = (bookId: string) => {
    setCurrentBookId(bookId);
    setCurrentPage('reader');
  };

  const handleLogout = () => {
    setUser(null);
    setUserWpmData(null);
    setCurrentBookId(null);
    localStorage.removeItem('userWpmData');
    setCurrentPage('auth');
  };

  const handleBackToHomepage = () => {
    setCurrentBookId(null);
    setCurrentPage('homepage');
  };

  const handleRetakeTest = () => {
    setCurrentPage('landing');
  };

  if (currentPage === 'auth') {
    return <Auth onAuth={handleAuth} />;
  }

  if (currentPage === 'landing' && user) {
    return <Landing username={user} onComplete={handleWpmComplete} />;
  }

  if (currentPage === 'homepage' && userWpmData) {
    return <Homepage userData={userWpmData} onStartReading={handleStartReading} onLogout={handleLogout} onRetakeTest={handleRetakeTest} />;
  }

  return <Reader onBackToHomepage={handleBackToHomepage} />;
}

export default App;
