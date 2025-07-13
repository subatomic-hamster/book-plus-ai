import { useEffect, useState } from 'react';
import axios from 'axios';

function Reader() {
  const [bookText, setBookText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get('http://localhost:8000/api/book1')
      .then((response) => {
        setBookText(response.data.text);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to fetch book text');
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="h-screen max-w-4xl mx-auto bg-white shadow-[5px_0_15px_rgba(0,0,0,0.1),-5px_0_15px_rgba(0,0,0,0.1)] overflow-y-auto">
        <div className="p-8">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600 text-lg">Loading book...</p>
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 text-lg">{error}</p>
            </div>
          )}
          
          {!loading && !error && (
            <div className="text-left text-gray-800 leading-relaxed text-base">
              {bookText.split('\n\n').map((paragraph, index) => (
                <p key={index} className="mb-6 first:indent-0 indent-8">
                  {paragraph}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reader; 