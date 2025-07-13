import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';

interface Paragraph {
  text: string;
  index: number;
  isLoading: boolean;
  hasError: boolean;
}

function Reader() {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [totalParagraphs, setTotalParagraphs] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Function to load a specific paragraph
  const loadParagraph = useCallback(async (index: number) => {
    try {
      const response = await axios.get(`http://localhost:8000/api/book1/paragraphs/${index}`);
      setParagraphs(prev => 
        prev.map(p => 
          p.index === index 
            ? { ...p, text: response.data.text, isLoading: false, hasError: false }
            : p
        )
      );
    } catch (err) {
      setParagraphs(prev => 
        prev.map(p => 
          p.index === index 
            ? { ...p, isLoading: false, hasError: true }
            : p
        )
      );
    }
  }, []);

  // Function to add a new paragraph placeholder
  const addParagraphPlaceholder = useCallback((index: number) => {
    setParagraphs(prev => {
      if (prev.some(p => p.index === index)) return prev;
      return [...prev, { text: '', index, isLoading: true, hasError: false }];
    });
    loadParagraph(index);
  }, [loadParagraph]);

  // Initial load - get total paragraphs and load first few
  useEffect(() => {
    const initializeReader = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/book1/paragraphs');
        const total = response.data.total_paragraphs;
        setTotalParagraphs(total);
        
        // Load first 5 paragraphs initially
        const initialParagraphs = Array.from({ length: Math.min(5, total) }, (_, i) => ({
          text: '',
          index: i,
          isLoading: true,
          hasError: false
        }));
        
        setParagraphs(initialParagraphs);
        setIsInitialLoading(false);
        
        // Load the initial paragraphs
        initialParagraphs.forEach(p => loadParagraph(p.index));
      } catch (err) {
        setError('Failed to initialize reader');
        setIsInitialLoading(false);
      }
    };

    initializeReader();
  }, [loadParagraph]);

  // Scroll handler for loading more paragraphs
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    // If we're near the bottom (80% scrolled), load more paragraphs
    if (scrollPercentage > 0.8) {
      const currentMaxIndex = Math.max(...paragraphs.map(p => p.index), -1);
      const nextIndex = currentMaxIndex + 1;
      
      if (nextIndex < totalParagraphs) {
        addParagraphPlaceholder(nextIndex);
      }
    }
  }, [paragraphs, totalParagraphs, addParagraphPlaceholder]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Loading animation component
  const LoadingAnimation = () => (
    <div className="flex items-center justify-center py-4">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );

  // Error component
  const ErrorComponent = ({ onRetry }: { onRetry: () => void }) => (
    <div className="flex items-center justify-center py-4">
      <div className="text-center">
        <p className="text-red-500 text-sm mb-2">Failed to load paragraph</p>
        <button 
          onClick={onRetry}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <div 
        ref={containerRef}
        className="h-screen max-w-4xl mx-auto bg-white shadow-[5px_0_15px_rgba(0,0,0,0.1),-5px_0_15px_rgba(0,0,0,0.1)] overflow-y-auto"
      >
        <div className="p-8">
          {isInitialLoading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600 text-lg">Loading book...</p>
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-500 text-lg">{error}</p>
            </div>
          )}
          
          {!isInitialLoading && !error && (
            <div className="text-left text-gray-800 leading-relaxed text-base">
              {paragraphs
                .sort((a, b) => a.index - b.index)
                .map((paragraph) => (
                  <div key={paragraph.index} className="mb-6">
                    {paragraph.isLoading ? (
                      <LoadingAnimation />
                    ) : paragraph.hasError ? (
                      <ErrorComponent onRetry={() => loadParagraph(paragraph.index)} />
                    ) : (
                      <p className="first:indent-0 indent-8">
                        {paragraph.text}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reader; 