import { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

interface Book {
  id: number;
  title: string;
  author: string;
  description?: string;
  isbn?: string;
  published_year?: number;
}

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios.get('http://localhost:8000/api/books')
      .then((response) => {
        setBooks(response.data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to fetch books');
        setLoading(false);
      });
  }, []);

  return (
    <div className="App">
      <h1>Book Plus AI</h1>
      {loading && <p>Loading books...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
        <ul>
          {books.map((book) => (
            <li key={book.id}>
              <strong>{book.title}</strong> by {book.author}
              {book.published_year && <> ({book.published_year})</>}
              <br />
              {book.description && <em>{book.description}</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
