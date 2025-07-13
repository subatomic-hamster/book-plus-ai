import { useState, useEffect } from 'react';
import axios from 'axios';

interface UserData {
  username: string;
  normal_wpm?: number;
  skimming_wpm?: number;
  genres?: string[];
  themes?: string[];
  created_at: string;
  last_login?: string;
}

interface HomepageProps {
  userData: UserData;
  onStartReading: (bookId: string) => void;
  onLogout: () => void;
  onRetakeTest: () => void;
  onBrowseBooks: () => void;
  onShowStats: () => void;
}

interface Book {
  id: string;
  title: string;
  author: string;
  progress: number;
  lastRead: string;
  totalParagraphs?: number;
  readParagraphs?: number;
}

interface ReadingProgress {
  [bookId: string]: {
    paragraphsRead: number;
    totalParagraphs: number;
    lastReadTime: string;
  };
}

function Homepage({ userData, onStartReading, onLogout, onRetakeTest, onBrowseBooks, onShowStats }: HomepageProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress>({});
  const [isLoading, setIsLoading] = useState(true);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Load books and reading progress
  useEffect(() => {
    const loadBooksAndProgress = async () => {
      try {
        // Load book info
        const bookResponse = await axios.get('http://localhost:8000/api/book1/paragraphs');
        const totalParagraphs = bookResponse.data.total_paragraphs;
        
        // Load reading progress from localStorage
        const savedProgress = localStorage.getItem(`reading_progress_${userData.username}`);
        let progress: ReadingProgress = {};
        
        if (savedProgress) {
          progress = JSON.parse(savedProgress);
        }
        
        // Calculate progress for book1
        const book1Progress = progress['book1'] || { paragraphsRead: 0, totalParagraphs, lastReadTime: 'Never' };
        const progressPercent = totalParagraphs > 0 ? Math.round((book1Progress.paragraphsRead / totalParagraphs) * 100) : 0;
        
        // Format last read time
        const lastRead = book1Progress.lastReadTime === 'Never' ? 'Never' : 
          new Date(book1Progress.lastReadTime).toLocaleDateString();
        
        const booksData: Book[] = [
          {
            id: 'book1',
            title: 'The Once and Future King',
            author: 'T.H. White',
            progress: progressPercent,
            lastRead,
            totalParagraphs,
            readParagraphs: book1Progress.paragraphsRead
          }
        ];
        
        setBooks(booksData);
        setReadingProgress(progress);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load books:', error);
        setIsLoading(false);
      }
    };

    loadBooksAndProgress();
  }, [userData.username]);

  return (
    <div className="min-h-screen bg-white">
      <div className="h-screen max-w-4xl mx-auto bg-white shadow-[5px_0_15px_rgba(0,0,0,0.1),-5px_0_15px_rgba(0,0,0,0.1)] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Welcome back, {userData.username}!
              </h1>
              <p className="text-gray-600 mt-1">
                Ready to continue your reading journey?
              </p>
            </div>
            <button
              onClick={onLogout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Logout
            </button>
          </div>

          {/* User Stats */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Reading Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{userData.normal_wpm || 'Not set'}</div>
                <div className="text-sm text-gray-600">Normal WPM</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{userData.skimming_wpm || 'Not set'}</div>
                <div className="text-sm text-gray-600">Skimming WPM</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{formatDate(userData.created_at)}</div>
                <div className="text-sm text-gray-600">Profile Created</div>
              </div>
            </div>
          </div>

          {/* Books Section */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Your Books</h2>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="text-gray-600">Loading your library...</div>
              </div>
            ) : (
              <div className="space-y-4">
                {books.map((book) => (
                <div
                  key={book.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-800 mb-1">
                        {book.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-2">by {book.author}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Progress: {book.progress}%</span>
                        <span>Last read: {book.lastRead}</span>
                      </div>
                      {book.progress > 0 && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gray-600 h-2 rounded-full"
                              style={{ width: `${book.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => onStartReading(book.id)}
                        className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
                      >
                        {book.progress > 0 ? 'Continue' : 'Start Reading'}
                      </button>
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button 
                onClick={onRetakeTest}
                className="text-gray-600 hover:text-gray-800 text-sm block"
              >
                Update Reading Speed & Preferences
              </button>
              <button 
                onClick={onBrowseBooks}
                className="text-gray-600 hover:text-gray-800 text-sm block"
              >
                Browse Book Library
              </button>
              <button 
                onClick={onShowStats}
                className="text-gray-600 hover:text-gray-800 text-sm block"
              >
                Reading Statistics
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Homepage;