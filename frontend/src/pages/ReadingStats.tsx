import { useState, useEffect } from 'react';
import axios from 'axios';

interface ReadingStatsProps {
  userData: {
    username: string;
    normal_wpm?: number;
    skimming_wpm?: number;
    genres?: string[];
    themes?: string[];
    created_at: string;
    last_login?: string;
  };
  onBackToHomepage: () => void;
}

interface ReadingPattern {
  content_type: string;
  avg_wpm: number;
  preference_score: number;
  attention_level: number;
}

interface SessionData {
  sessionId: string;
  totalSections: number;
  avgDwellTime: number;
  avgWPM: number;
  lastUpdate: number;
}

function ReadingStats({ userData, onBackToHomepage }: ReadingStatsProps) {
  const [patterns, setPatterns] = useState<Record<string, ReadingPattern>>({});
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Load reading patterns
        const patternsResponse = await axios.get(`http://localhost:8000/api/reading-patterns/${userData.username}`);
        setPatterns(patternsResponse.data);

        // Load recent session data from localStorage
        const recentSession = localStorage.getItem('currentReadingSession');
        if (recentSession) {
          setSessionData(JSON.parse(recentSession));
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load reading stats:', error);
        setIsLoading(false);
      }
    };

    loadStats();
  }, [userData.username]);

  const formatContentType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getAttentionLabel = (level: number) => {
    if (level > 0.7) return 'Very Focused';
    if (level > 0.5) return 'Focused';
    if (level > 0.3) return 'Moderate';
    return 'Scanning';
  };

  const getPreferenceLabel = (score: number) => {
    if (score > 0.7) return 'Love';
    if (score > 0.5) return 'Like';
    if (score > 0.3) return 'Neutral';
    return 'Skip';
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="h-screen max-w-4xl mx-auto bg-white shadow-[5px_0_15px_rgba(0,0,0,0.1),-5px_0_15px_rgba(0,0,0,0.1)] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Reading Statistics</h1>
              <p className="text-gray-600 mt-1">
                Your personalized reading insights
              </p>
            </div>
            <button
              onClick={onBackToHomepage}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Back to Library
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-gray-600">Loading your statistics...</div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Reading Profile Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Reading Profile</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">{userData.normal_wpm || 'Not set'}</div>
                    <div className="text-sm text-gray-600">Normal WPM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">{userData.skimming_wpm || 'Not set'}</div>
                    <div className="text-sm text-gray-600">Skimming WPM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">{Object.keys(patterns).length}</div>
                    <div className="text-sm text-gray-600">Content Types Learned</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-800">
                      {sessionData ? sessionData.totalSections : 0}
                    </div>
                    <div className="text-sm text-gray-600">Sections Read Recently</div>
                  </div>
                </div>
              </div>

              {/* Recent Session */}
              {sessionData && (
                <div className="bg-blue-50 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Latest Reading Session</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-lg font-medium text-gray-800">{sessionData.avgWPM.toFixed(0)} WPM</div>
                      <div className="text-sm text-gray-600">Average Speed</div>
                    </div>
                    <div>
                      <div className="text-lg font-medium text-gray-800">{(sessionData.avgDwellTime / 1000).toFixed(1)}s</div>
                      <div className="text-sm text-gray-600">Avg Time per Section</div>
                    </div>
                    <div>
                      <div className="text-lg font-medium text-gray-800">
                        {new Date(sessionData.lastUpdate).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-600">Last Reading</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Type Patterns */}
              {Object.keys(patterns).length > 0 && (
                <div className="bg-white border rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">Content Preferences</h2>
                  <div className="space-y-4">
                    {Object.entries(patterns).map(([type, pattern]) => (
                      <div key={type} className="border-b border-gray-100 pb-4 last:border-b-0">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium text-gray-800">{formatContentType(type)}</h3>
                          <span className="text-sm text-gray-500">{pattern.avg_wpm.toFixed(0)} WPM avg</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Attention Level: </span>
                            <span className="font-medium">{getAttentionLabel(pattern.attention_level)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Preference: </span>
                            <span className="font-medium">{getPreferenceLabel(pattern.preference_score)}</span>
                          </div>
                        </div>
                        {/* Visual bar for attention level */}
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${pattern.attention_level * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preferences */}
              <div className="bg-green-50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Preferences</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Favorite Genres</h3>
                    <div className="flex flex-wrap gap-2">
                      {userData.genres?.map((genre) => (
                        <span key={genre} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Preferred Themes</h3>
                    <div className="flex flex-wrap gap-2">
                      {userData.themes?.map((theme) => (
                        <span key={theme} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* No Data State */}
              {Object.keys(patterns).length === 0 && !sessionData && (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">No Reading Data Yet</h3>
                  <p className="text-gray-600 text-sm">
                    Start reading to see your personalized statistics and patterns appear here!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReadingStats;