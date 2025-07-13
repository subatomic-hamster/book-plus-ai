import { useState, useEffect } from 'react';
import axios from 'axios';

interface BrowseBooksProps {
  onBackToHomepage: () => void;
  onStartReading: (bookId: string) => void;
}

interface BookInfo {
  id: string;
  title: string;
  author: string;
  description: string;
  totalParagraphs: number;
}

function BrowseBooks({ onBackToHomepage, onStartReading }: BrowseBooksProps) {
  const [books, setBooks] = useState<BookInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        // For now, we just have one book, but this structure allows for expansion
        const response = await axios.get('http://localhost:8000/api/book1/paragraphs');
        const totalParagraphs = response.data.total_paragraphs;
        
        const booksData: BookInfo[] = [
          {
            id: 'book1',
            title: 'The Once and Future King',
            author: 'T.H. White',
            description: 'A retelling of the Arthurian legend, focusing on the early life of King Arthur and his education under the wizard Merlin. This classic work combines humor, wisdom, and adventure in its exploration of power, justice, and human nature.',
            totalParagraphs
          }
        ];
        
        setBooks(booksData);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load books:', error);
        setIsLoading(false);
      }
    };

    loadBooks();
  }, []);

  const handleStartReading = (bookId: string) => {
    onStartReading(bookId);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="h-screen max-w-4xl mx-auto bg-white shadow-[5px_0_15px_rgba(0,0,0,0.1),-5px_0_15px_rgba(0,0,0,0.1)] overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Browse Books</h1>
              <p className="text-gray-600 mt-1">
                Discover your next great read
              </p>
            </div>
            <button
              onClick={onBackToHomepage}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Back to Library
            </button>
          </div>

          {/* Books Grid */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-gray-600">Loading books...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleStartReading(book.id)}
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      {book.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">by {book.author}</p>
                    <p className="text-gray-700 text-sm leading-relaxed mb-4">
                      {book.description}
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                      {book.totalParagraphs} sections
                    </div>
                    <button
                      className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartReading(book.id);
                      }}
                    >
                      Read Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Coming Soon */}
          <div className="mt-12 p-6 bg-gray-50 rounded-lg text-center">
            <h3 className="text-lg font-medium text-gray-800 mb-2">More Books Coming Soon</h3>
            <p className="text-gray-600 text-sm">
              We're working on adding more titles to your adaptive reading library. 
              Each book will feature intelligent content adaptation based on your reading patterns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BrowseBooks;