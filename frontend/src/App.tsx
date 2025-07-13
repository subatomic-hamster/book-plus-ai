import { useState, useEffect } from 'react';
import axios from 'axios';
import Auth from './pages/Auth';
import Landing from './pages/Landing';
import Homepage from './pages/Homepage';
import Reader from './pages/Reader';

interface UserData {
  username: string;
  normal_wpm?: number;
  skimming_wpm?: number;
  genres?: string[];
  themes?: string[];
  created_at: string;
  last_login?: string;
}

function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [currentPage, setCurrentPage] = useState<'auth' | 'landing' | 'homepage' | 'reader'>('auth');
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      
      if (token && userData) {
        try {
          // Set auth header
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Verify token is still valid by fetching user profile
          const response = await axios.get('http://localhost:8000/api/auth/me');
          const userProfile = response.data;
          
          setUser(userProfile);
          
          // Check if user has complete profile
          if (userProfile.normal_wpm && userProfile.skimming_wpm && userProfile.genres && userProfile.themes) {
            setCurrentPage('homepage');
          } else {
            setCurrentPage('landing');
          }
        } catch (error) {
          // Token invalid, clear auth data
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
          delete axios.defaults.headers.common['Authorization'];
          setCurrentPage('auth');
        }
      } else {
        setCurrentPage('auth');
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const handleAuth = (userData: UserData) => {
    setUser(userData);
    
    // Check if user has complete profile
    if (userData.normal_wpm && userData.skimming_wpm && userData.genres && userData.themes) {
      setCurrentPage('homepage');
    } else {
      setCurrentPage('landing');
    }
  };

  const handleWpmComplete = async (normalWpm: number, skimmingWpm: number, genres: string[], themes: string[]) => {
    try {
      // Update user profile on server
      const response = await axios.put('http://localhost:8000/api/auth/me', {
        normal_wpm: normalWpm,
        skimming_wpm: skimmingWpm,
        genres,
        themes
      });
      
      const updatedUser = response.data;
      setUser(updatedUser);
      
      // Update localStorage
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      
      setCurrentPage('homepage');
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleStartReading = (bookId: string) => {
    setCurrentBookId(bookId);
    setCurrentPage('reader');
  };

  const handleLogout = async () => {
    try {
      // Logout from server
      await axios.post('http://localhost:8000/api/auth/logout');
    } catch (error) {
      // Continue with logout even if server request fails
    }
    
    // Clear client state
    setUser(null);
    setCurrentBookId(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentPage('auth');
  };

  const handleBackToHomepage = () => {
    setCurrentBookId(null);
    setCurrentPage('homepage');
  };

  const handleRetakeTest = () => {
    setCurrentPage('landing');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (currentPage === 'auth') {
    return <Auth onAuth={handleAuth} />;
  }

  if (currentPage === 'landing' && user) {
    return <Landing username={user.username} onComplete={handleWpmComplete} />;
  }

  if (currentPage === 'homepage' && user) {
    return <Homepage userData={user} onStartReading={handleStartReading} onLogout={handleLogout} onRetakeTest={handleRetakeTest} />;
  }

  return <Reader onBackToHomepage={handleBackToHomepage} userData={user} />;
}

export default App;
