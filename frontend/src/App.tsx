import { useState, useEffect } from 'react';
import Auth from './pages/Auth';
import Landing from './pages/Landing';
import Reader from './pages/Reader';

interface UserData {
  username: string;
  normalWpm: number;
  skimmingWpm: number;
  timestamp: number;
}

function App() {
  const [user, setUser] = useState<string | null>(null);
  const [userWpmData, setUserWpmData] = useState<UserData | null>(null);
  const [currentPage, setCurrentPage] = useState<'auth' | 'landing' | 'reader'>('auth');

  useEffect(() => {
    // Always start with auth page - remove auto-login
    // const savedData = localStorage.getItem('userWpmData');
    // if (savedData) {
    //   const userData = JSON.parse(savedData) as UserData;
    //   setUser(userData.username);
    //   setUserWpmData(userData);
    //   setCurrentPage('reader');
    // }
  }, []);

  const handleAuth = (username: string) => {
    setUser(username);
    setCurrentPage('landing');
  };

  const handleWpmComplete = (normalWpm: number, skimmingWpm: number) => {
    const userData: UserData = {
      username: user!,
      normalWpm,
      skimmingWpm,
      timestamp: Date.now()
    };
    setUserWpmData(userData);
    setCurrentPage('reader');
  };

  if (currentPage === 'auth') {
    return <Auth onAuth={handleAuth} />;
  }

  if (currentPage === 'landing' && user) {
    return <Landing username={user} onComplete={handleWpmComplete} />;
  }

  return <Reader />;
}

export default App;
