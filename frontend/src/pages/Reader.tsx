import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';

interface Paragraph {
  text: string;
  index: number;
  isLoading: boolean;
  hasError: boolean;
  readingClassification?: 'fast-skim' | 'skim' | 'normal' | 'slow' | 'unread';
  adaptiveContent?: AdaptiveContent;
  contentType?: string;
  importanceScore?: number;
}

interface AdaptiveContent {
  version: string;
  text: string;
  highlighted_sentences: string[];
  emphasis_type?: string;
}

interface ContentSegment {
  text: string;
  type: string;
  condensed_text?: string;
  key_sentences: string[];
  start_pos: number;
  end_pos: number;
}

interface AnalyzedParagraph {
  index: number;
  original_text: string;
  segments: ContentSegment[];
  reading_difficulty: number;
  importance_score: number;
  primary_type: string;
}

interface SectionTimingData {
  paragraphIndex: number;
  startTime: number;
  endTime?: number;
  totalTime: number;
  scrollBehavior: 'normal' | 'fast' | 'slow';
  isVisible: boolean;
  viewportDwellTime: number;
}

interface ReadingSession {
  sessionId: string;
  startTime: number;
  sectionTimings: SectionTimingData[];
  scrollEvents: Array<{
    timestamp: number;
    scrollTop: number;
    scrollSpeed: number;
  }>;
}

interface ReaderProps {
  onBackToHomepage?: () => void;
  userData?: any;
}

function Reader({ onBackToHomepage, userData }: ReaderProps) {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [totalParagraphs, setTotalParagraphs] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Adaptive content state
  const [contentVersion, setContentVersion] = useState<'full' | 'condensed' | 'summary' | 'auto'>('auto');
  const [analyzedParagraphs, setAnalyzedParagraphs] = useState<Map<number, AnalyzedParagraph>>(new Map());
  const [readingPatterns, setReadingPatterns] = useState<Record<string, any>>({});
  
  // Reading analytics state
  const [readingSession, setReadingSession] = useState<ReadingSession>({
    sessionId: `session_${Date.now()}`,
    startTime: Date.now(),
    sectionTimings: [],
    scrollEvents: []
  });
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const intersectionObserver = useRef<IntersectionObserver | null>(null);
  const lastScrollTime = useRef<number>(Date.now());
  const lastScrollTop = useRef<number>(0);

  // Function to load a specific paragraph with adaptive content
  const loadParagraph = useCallback(async (index: number) => {
    try {
      // Load basic paragraph
      const basicResponse = await axios.get(`http://localhost:8000/api/book1/paragraphs/${index}`);
      
      // Load analyzed version
      const analyzedResponse = await axios.get(`http://localhost:8000/api/book1/paragraphs/${index}/analyze`);
      const analyzed: AnalyzedParagraph = analyzedResponse.data;
      setAnalyzedParagraphs(prev => new Map(prev.set(index, analyzed)));
      
      // Load adaptive content
      let adaptiveContent: AdaptiveContent | undefined;
      try {
        const adaptiveResponse = await axios.get(`http://localhost:8000/api/book1/paragraphs/${index}/adaptive?version=${contentVersion}`);
        adaptiveContent = adaptiveResponse.data;
      } catch (adaptiveErr) {
        // Fallback to basic content if adaptive fails
        adaptiveContent = {
          version: 'full',
          text: basicResponse.data.text,
          highlighted_sentences: [],
          emphasis_type: analyzed.primary_type
        };
      }
      
      setParagraphs(prev => 
        prev.map(p => 
          p.index === index 
            ? { 
                ...p, 
                text: basicResponse.data.text, 
                isLoading: false, 
                hasError: false,
                adaptiveContent,
                contentType: analyzed.primary_type,
                importanceScore: analyzed.importance_score
              }
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
  }, [contentVersion]);

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

  // Analytics: Start section timing
  const startSectionTiming = useCallback((paragraphIndex: number) => {
    const now = Date.now();
    setReadingSession(prev => {
      const existingIndex = prev.sectionTimings.findIndex(st => st.paragraphIndex === paragraphIndex);
      if (existingIndex >= 0) {
        // Update existing timing
        const updated = [...prev.sectionTimings];
        updated[existingIndex] = {
          ...updated[existingIndex],
          startTime: now,
          isVisible: true
        };
        return { ...prev, sectionTimings: updated };
      } else {
        // Add new timing
        return {
          ...prev,
          sectionTimings: [...prev.sectionTimings, {
            paragraphIndex,
            startTime: now,
            totalTime: 0,
            scrollBehavior: 'normal',
            isVisible: true,
            viewportDwellTime: 0
          }]
        };
      }
    });
  }, []);

  // Analytics: Calculate WPM for each section
  const calculateSectionWPM = useCallback((paragraphIndex: number, dwellTime: number) => {
    const paragraph = paragraphs.find(p => p.index === paragraphIndex);
    if (!paragraph || !paragraph.text || dwellTime === 0) return 0;
    
    const wordCount = paragraph.text.split(/\\s+/).length;
    const timeInMinutes = dwellTime / 60000; // Convert ms to minutes
    return Math.round(wordCount / timeInMinutes);
  }, [paragraphs]);

  // Update paragraph classification based on reading data and user baseline
  const updateParagraphClassification = useCallback((paragraphIndex: number, wpm: number) => {
    let classification: 'fast-skim' | 'skim' | 'normal' | 'slow';
    
    if (userData?.normal_wpm && userData?.skimming_wpm) {
      // Use user's personal baseline for classification
      const userNormalWpm = userData.normal_wpm;
      const userSkimWpm = userData.skimming_wpm;
      
      if (wpm >= userSkimWpm * 1.5) {
        classification = 'fast-skim';
      } else if (wpm >= userNormalWpm * 1.2) {
        classification = 'skim';
      } else if (wpm >= userNormalWpm * 0.7) {
        classification = 'normal';
      } else {
        classification = 'slow';
      }
    } else {
      // Fallback to generic thresholds
      classification = wpm > 300 ? 'fast-skim' : wpm > 150 ? 'skim' : wpm > 50 ? 'normal' : 'slow';
    }
    
    setParagraphs(prev => 
      prev.map(p => 
        p.index === paragraphIndex 
          ? { ...p, readingClassification: classification }
          : p
      )
    );
  }, [userData]);

  // Analytics: End section timing
  const endSectionTiming = useCallback((paragraphIndex: number) => {
    const now = Date.now();
    setReadingSession(prev => {
      const updated = prev.sectionTimings.map(st => {
        if (st.paragraphIndex === paragraphIndex && st.isVisible) {
          const dwellTime = now - st.startTime;
          const newTotalTime = st.totalTime + dwellTime;
          
          // Calculate WPM and update visual classification
          const wpm = calculateSectionWPM(paragraphIndex, newTotalTime);
          if (wpm > 0) {
            updateParagraphClassification(paragraphIndex, wpm);
            updateReadingPattern(paragraphIndex, wpm, dwellTime);
          }
          
          return {
            ...st,
            endTime: now,
            totalTime: newTotalTime,
            viewportDwellTime: st.viewportDwellTime + dwellTime,
            isVisible: false
          };
        }
        return st;
      });
      return { ...prev, sectionTimings: updated };
    });
  }, [calculateSectionWPM, updateParagraphClassification]);

  // Analytics: Track scroll behavior
  const trackScrollEvent = useCallback((scrollTop: number) => {
    const now = Date.now();
    const timeDelta = now - lastScrollTime.current;
    const scrollDelta = Math.abs(scrollTop - lastScrollTop.current);
    const scrollSpeed = timeDelta > 0 ? scrollDelta / timeDelta : 0;

    setReadingSession(prev => ({
      ...prev,
      scrollEvents: [...prev.scrollEvents.slice(-50), { // Keep last 50 events
        timestamp: now,
        scrollTop,
        scrollSpeed
      }]
    }));

    lastScrollTime.current = now;
    lastScrollTop.current = scrollTop;
  }, []);

  // Scroll handler for loading more paragraphs + analytics
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    // Track scroll for analytics
    trackScrollEvent(scrollTop);
    
    // If we're near the bottom (80% scrolled), load more paragraphs
    if (scrollPercentage > 0.8) {
      const currentMaxIndex = Math.max(...paragraphs.map(p => p.index), -1);
      const nextIndex = currentMaxIndex + 1;
      
      if (nextIndex < totalParagraphs) {
        addParagraphPlaceholder(nextIndex);
      }
    }
  }, [paragraphs, totalParagraphs, addParagraphPlaceholder, trackScrollEvent]);

  // Setup Intersection Observer for section visibility tracking
  useEffect(() => {
    if (!containerRef.current) return;

    intersectionObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const paragraphIndex = parseInt(entry.target.getAttribute('data-paragraph-index') || '0');
          
          if (entry.isIntersecting) {
            // Section entered viewport
            startSectionTiming(paragraphIndex);
          } else {
            // Section left viewport
            endSectionTiming(paragraphIndex);
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '0px',
        threshold: 0.5 // Trigger when 50% of section is visible
      }
    );

    return () => {
      if (intersectionObserver.current) {
        intersectionObserver.current.disconnect();
      }
    };
  }, [startSectionTiming, endSectionTiming]);

  // Observe paragraph elements when they're added
  useEffect(() => {
    if (!intersectionObserver.current) return;

    sectionRefs.current.forEach((element) => {
      intersectionObserver.current?.observe(element);
    });

    return () => {
      sectionRefs.current.forEach((element) => {
        intersectionObserver.current?.unobserve(element);
      });
    };
  }, [paragraphs]);

  // Setup scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Visual: Get CSS classes for reading classification
  const getClassificationStyle = useCallback((classification?: string) => {
    switch (classification) {
      case 'fast-skim':
        return 'text-gray-400 bg-blue-50 border-l-4 border-blue-300';
      case 'skim':
        return 'text-gray-500 bg-yellow-50 border-l-4 border-yellow-300';
      case 'normal':
        return 'text-gray-700 bg-green-50 border-l-4 border-green-300';
      case 'slow':
        return 'text-gray-800 bg-purple-50 border-l-4 border-purple-300';
      default:
        return 'text-gray-800';
    }
  }, []);

  // Update reading pattern based on reading behavior
  const updateReadingPattern = useCallback(async (paragraphIndex: number, wpm: number, dwellTime: number) => {
    if (!userData?.username) return;

    const analyzed = analyzedParagraphs.get(paragraphIndex);
    if (!analyzed) return;

    try {
      await axios.post(`http://localhost:8000/api/reading-patterns/${userData.username}`, null, {
        params: {
          content_type: analyzed.primary_type,
          wpm,
          dwell_time: dwellTime / 1000 // Convert to seconds
        }
      });
    } catch (error) {
      console.error('Failed to update reading pattern:', error);
    }
  }, [userData, analyzedParagraphs]);

  // Reload adaptive content when version changes
  const reloadAdaptiveContent = useCallback(async () => {
    const loadedParagraphs = paragraphs.filter(p => !p.isLoading && !p.hasError);
    
    for (const paragraph of loadedParagraphs) {
      try {
        const adaptiveResponse = await axios.get(`http://localhost:8000/api/book1/paragraphs/${paragraph.index}/adaptive?version=${contentVersion}`);
        const adaptiveContent: AdaptiveContent = adaptiveResponse.data;
        
        setParagraphs(prev => 
          prev.map(p => 
            p.index === paragraph.index 
              ? { ...p, adaptiveContent }
              : p
          )
        );
      } catch (error) {
        console.error(`Failed to reload adaptive content for paragraph ${paragraph.index}:`, error);
      }
    }
  }, [paragraphs, contentVersion]);

  // Handle content version change
  const handleVersionChange = useCallback((newVersion: 'full' | 'condensed' | 'summary' | 'auto') => {
    setContentVersion(newVersion);
  }, []);

  // Effect to reload content when version changes
  useEffect(() => {
    if (paragraphs.length > 0) {
      reloadAdaptiveContent();
    }
  }, [contentVersion]);

  // Analytics: Export data to downloadable file
  const exportAnalyticsData = useCallback(() => {
    const analyticsData = {
      sessionId: readingSession.sessionId,
      sessionDuration: Date.now() - readingSession.startTime,
      timestamp: new Date().toISOString(),
      sectionAnalytics: readingSession.sectionTimings.map(st => {
        const wpm = calculateSectionWPM(st.paragraphIndex, st.totalTime);
        const paragraph = paragraphs.find(p => p.index === st.paragraphIndex);
        return {
          ...st,
          wordCount: paragraph?.text.split(/\\s+/).length || 0,
          wpm,
          classification: wpm > 300 ? 'fast-skim' : wpm > 150 ? 'skim' : wpm > 50 ? 'normal' : 'slow'
        };
      }),
      scrollAnalytics: {
        totalScrollEvents: readingSession.scrollEvents.length,
        avgScrollSpeed: readingSession.scrollEvents.reduce((sum, se) => sum + se.scrollSpeed, 0) / readingSession.scrollEvents.length,
        scrollPattern: readingSession.scrollEvents
      },
      summary: {
        totalSections: readingSession.sectionTimings.length,
        avgDwellTime: readingSession.sectionTimings.reduce((sum, st) => sum + st.totalTime, 0) / readingSession.sectionTimings.length,
        avgWPM: readingSession.sectionTimings.reduce((sum, st) => sum + calculateSectionWPM(st.paragraphIndex, st.totalTime), 0) / readingSession.sectionTimings.length
      }
    };

    const blob = new Blob([JSON.stringify(analyticsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reading-analytics-${readingSession.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [readingSession, calculateSectionWPM, paragraphs]);

  // Analytics: Save session data more frequently and provide export
  useEffect(() => {
    const interval = setInterval(() => {
      if (readingSession.sectionTimings.length > 0) {
        const currentAnalytics = {
          sessionId: readingSession.sessionId,
          totalSections: readingSession.sectionTimings.length,
          avgDwellTime: readingSession.sectionTimings.reduce((sum, st) => sum + st.totalTime, 0) / readingSession.sectionTimings.length,
          avgWPM: readingSession.sectionTimings.reduce((sum, st) => sum + calculateSectionWPM(st.paragraphIndex, st.totalTime), 0) / readingSession.sectionTimings.length,
          recentScrollEvents: readingSession.scrollEvents.slice(-10),
          lastUpdate: Date.now()
        };
        
        console.log('📖 Reading Analytics:', currentAnalytics);
        
        // Store in localStorage for persistence
        localStorage.setItem('currentReadingSession', JSON.stringify(currentAnalytics));
      }
    }, 2000); // Update every 2 seconds instead of 10

    return () => clearInterval(interval);
  }, [readingSession, calculateSectionWPM]);

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

  // Content type indicator
  const ContentTypeIndicator = ({ type, importance }: { type?: string, importance?: number }) => {
    if (!type) return null;
    
    const getTypeColor = (type: string) => {
      switch (type) {
        case 'dialogue': return 'bg-blue-100 text-blue-800';
        case 'action': return 'bg-red-100 text-red-800';
        case 'plot_critical': return 'bg-orange-100 text-orange-800';
        case 'description': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(type)}`}>
          {type.replace('_', ' ')}
        </span>
        {importance !== undefined && (
          <span className="text-xs text-gray-500">
            Importance: {Math.round(importance * 100)}%
          </span>
        )}
      </div>
    );
  };

  // Highlight key sentences in text
  const renderHighlightedText = (text: string, highlightedSentences: string[]) => {
    if (highlightedSentences.length === 0) {
      return text;
    }

    let highlightedText = text;
    highlightedSentences.forEach(sentence => {
      const cleanSentence = sentence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars
      const regex = new RegExp(`(${cleanSentence})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
    });

    return (
      <span dangerouslySetInnerHTML={{ __html: highlightedText }} />
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <div 
        ref={containerRef}
        className="h-screen max-w-4xl mx-auto bg-white shadow-[5px_0_15px_rgba(0,0,0,0.1),-5px_0_15px_rgba(0,0,0,0.1)] overflow-y-auto"
      >
        <div className="p-8">
          {onBackToHomepage && (
            <div className="mb-6 pb-4 border-b border-gray-200">
              <button
                onClick={onBackToHomepage}
                className="text-gray-600 hover:text-gray-800 text-sm flex items-center"
              >
                ← Back to Library
              </button>
            </div>
          )}

          {/* Adaptive Content Controls */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-700">Content Adaptation</h3>
              <select 
                value={contentVersion} 
                onChange={(e) => handleVersionChange(e.target.value as any)}
                className="px-2 py-1 text-xs border rounded bg-white"
              >
                <option value="auto">Auto-Adapt</option>
                <option value="full">Full Text</option>
                <option value="condensed">Condensed</option>
                <option value="summary">Summary</option>
              </select>
            </div>
            <div className="text-xs text-gray-600">
              {contentVersion === 'auto' ? 'Text adapts based on your reading patterns' :
               contentVersion === 'full' ? 'Complete original text with key highlights' :
               contentVersion === 'condensed' ? 'Shortened descriptions, full dialogue & action' :
               'Key plot points and dialogue only'}
            </div>
          </div>

          {/* Visual Indicators Legend */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Reading Speed Indicators</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-50 border-l-4 border-blue-300 mr-2"></div>
                <span>Fast Skim</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-50 border-l-4 border-yellow-300 mr-2"></div>
                <span>Skim</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-50 border-l-4 border-green-300 mr-2"></div>
                <span>Normal</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-purple-50 border-l-4 border-purple-300 mr-2"></div>
                <span>Slow</span>
              </div>
            </div>
            {userData?.normal_wpm && userData?.skimming_wpm && (
              <div className="mt-2 text-xs text-gray-600">
                Based on your reading speeds: {userData.normal_wpm} WPM (normal), {userData.skimming_wpm} WPM (skim)
              </div>
            )}
          </div>

          {/* Analytics Dashboard */}
          {readingSession.sectionTimings.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium text-gray-700">Reading Analytics</h3>
                <button
                  onClick={exportAnalyticsData}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                >
                  Export Data
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Sections Read:</span>
                  <div className="font-medium">{readingSession.sectionTimings.length}</div>
                </div>
                <div>
                  <span className="text-gray-500">Avg Dwell Time:</span>
                  <div className="font-medium">{(readingSession.sectionTimings.reduce((sum, st) => sum + st.totalTime, 0) / readingSession.sectionTimings.length / 1000).toFixed(1)}s</div>
                </div>
                <div>
                  <span className="text-gray-500">Avg WPM:</span>
                  <div className="font-medium">{Math.round(readingSession.sectionTimings.reduce((sum, st) => sum + calculateSectionWPM(st.paragraphIndex, st.totalTime), 0) / readingSession.sectionTimings.length)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Session Time:</span>
                  <div className="font-medium">{Math.round((Date.now() - readingSession.startTime) / 1000)}s</div>
                </div>
              </div>
            </div>
          )}
          
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
                      <div className="mb-4">
                        <ContentTypeIndicator 
                          type={paragraph.contentType} 
                          importance={paragraph.importanceScore} 
                        />
                        <div 
                          className={`p-3 rounded transition-all duration-500 ${getClassificationStyle(paragraph.readingClassification)}`}
                          ref={(el) => {
                            if (el) {
                              sectionRefs.current.set(paragraph.index, el);
                            }
                          }}
                          data-paragraph-index={paragraph.index}
                        >
                          {paragraph.adaptiveContent ? (
                            <div>
                              {paragraph.adaptiveContent.version !== 'full' && (
                                <div className="text-xs text-gray-500 mb-2 italic">
                                  {paragraph.adaptiveContent.version === 'condensed' ? 'Condensed view' : 'Summary view'}
                                </div>
                              )}
                              <p className="first:indent-0 indent-8 leading-relaxed">
                                {renderHighlightedText(
                                  paragraph.adaptiveContent.text,
                                  paragraph.adaptiveContent.highlighted_sentences
                                )}
                              </p>
                              {paragraph.adaptiveContent.version !== 'full' && (
                                <button 
                                  onClick={() => {
                                    // Toggle to full view for this paragraph
                                    setParagraphs(prev => 
                                      prev.map(p => 
                                        p.index === paragraph.index 
                                          ? { ...p, adaptiveContent: { ...p.adaptiveContent!, version: 'full', text: p.text } }
                                          : p
                                      )
                                    );
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 mt-2 underline"
                                >
                                  Show full text
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="first:indent-0 indent-8 leading-relaxed">
                              {paragraph.text}
                            </p>
                          )}
                        </div>
                      </div>
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