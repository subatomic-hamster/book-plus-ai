import { useState, useEffect } from 'react';

interface LandingProps {
  username: string;
  onComplete: (normalWpm: number, skimmingWpm: number) => void;
}

interface TestResult {
  wpm: number;
  timeMs: number;
}

const NORMAL_TEXTS = [
  "Reading comprehension is the ability to process text, understand its meaning, and to integrate with what the reader already knows. Fundamental skills required in efficient reading comprehension are knowing meaning of words, ability to understand meaning of a word from discourse context, ability to follow organization of passage and to identify antecedents and references in it, ability to draw inferences from a passage about its contents, ability to identify the main thought of a passage, ability to answer questions answered in a passage, ability to recognize the literary devices or propositional structures used in a passage and determine its tone, to understand the situational mood conveyed for assertions, questioning, commanding, refraining etc. and finally ability to determine writer's purpose, intent and point of view, and draw inferences about the writer.",
  
  "The process of learning to read involves several cognitive mechanisms. Children must first develop phonological awareness, the understanding that words are made up of individual sounds or phonemes. This foundational skill allows them to decode written symbols into spoken language. Subsequently, they must build vocabulary and comprehension skills, learning to extract meaning from the text beyond mere word recognition. Fluency develops as readers become more automatic in their word recognition, allowing cognitive resources to be devoted to comprehension rather than decoding. Research has shown that reading instruction is most effective when it incorporates explicit teaching of phonics, vocabulary, fluency, and comprehension strategies in a balanced approach.",
  
  "Critical thinking in reading involves analyzing, evaluating, and synthesizing information from multiple sources. Effective readers question the author's assumptions, identify bias, and consider alternative perspectives. They distinguish between facts and opinions, recognize logical fallacies, and evaluate the credibility of sources. This skill becomes increasingly important in our digital age, where readers must navigate vast amounts of information and distinguish reliable sources from misinformation. Teaching critical reading skills requires explicit instruction in evaluation techniques, practice with diverse texts, and opportunities for students to discuss and defend their interpretations with peers and instructors."
];

const SKIMMING_TEXTS = [
  "Skimming is a reading technique meant to look for main or general ideas within a text, without going into detailed and exhaustive reading. This involves reading quickly through a document to absorb its overall meaning. Skimming works well to find dates, names, and places. It might also be used to review graphs, tables, and charts. Skimming allows readers to get a general overview and understanding of the material quickly. When you skim, you are looking for the gist, the general idea. You are not reading for specific details or trying to understand every single word. Instead, you are trying to get a sense of what the text is about and whether it contains information relevant to your purposes.",
  
  "Speed reading techniques include reducing subvocalization, expanding peripheral vision, and minimizing regression. Subvocalization is the habit of silently pronouncing words while reading, which limits reading speed to speaking pace. Advanced readers learn to recognize word patterns and meanings without internal speech. Peripheral vision training helps readers take in more words per fixation, reducing the number of eye movements required. Regression, or re-reading previously covered text, can be minimized through concentration and comprehension strategies. While speed reading can significantly increase reading rates, critics argue that comprehension may suffer at very high speeds, making it most suitable for material that doesn't require deep analysis.",
  
  "Information overload in the digital age requires efficient reading strategies. With endless streams of articles, emails, and social media posts, readers must quickly determine what deserves attention. Effective scanning involves looking for keywords, headings, and visual cues to identify relevant content. Preview reading helps establish context before diving deeper. The ability to rapidly assess source credibility and content quality has become essential. Readers must also develop skills in filtering information, bookmarking important content for later review, and organizing digital information for easy retrieval. These skills help manage the constant influx of information while maintaining productivity and focus."
];

function Landing({ username, onComplete }: LandingProps) {
  const [currentTest, setCurrentTest] = useState<'normal' | 'skimming' | null>(null);
  const [currentPassageIndex, setCurrentPassageIndex] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [normalResults, setNormalResults] = useState<TestResult[]>([]);
  const [skimmingResults, setSkimmingResults] = useState<TestResult[]>([]);
  const [testPhase, setTestPhase] = useState<'ready' | 'reading' | 'complete'>('ready');

  const getCurrentText = () => {
    if (currentTest === 'normal') {
      return NORMAL_TEXTS[currentPassageIndex];
    } else if (currentTest === 'skimming') {
      return SKIMMING_TEXTS[currentPassageIndex];
    }
    return '';
  };

  const getCurrentWordCount = () => {
    return getCurrentText().split(' ').length;
  };

  const startReading = (testType: 'normal' | 'skimming') => {
    setCurrentTest(testType);
    setCurrentPassageIndex(0);
    setTestPhase('ready');
  };

  const startTiming = () => {
    setStartTime(Date.now());
    setTestPhase('reading');
  };

  const finishPassage = () => {
    if (!startTime) return;

    const endTime = Date.now();
    const timeMs = endTime - startTime;
    const timeInMinutes = timeMs / 60000;
    const wordCount = getCurrentWordCount();
    const wpm = Math.round(wordCount / timeInMinutes);

    const result: TestResult = { wpm, timeMs };

    if (currentTest === 'normal') {
      const newResults = [...normalResults, result];
      setNormalResults(newResults);
      
      if (currentPassageIndex < NORMAL_TEXTS.length - 1) {
        setCurrentPassageIndex(currentPassageIndex + 1);
        setTestPhase('ready');
        setStartTime(null);
      } else {
        setTestPhase('complete');
        setCurrentTest(null);
      }
    } else if (currentTest === 'skimming') {
      const newResults = [...skimmingResults, result];
      setSkimmingResults(newResults);
      
      if (currentPassageIndex < SKIMMING_TEXTS.length - 1) {
        setCurrentPassageIndex(currentPassageIndex + 1);
        setTestPhase('ready');
        setStartTime(null);
      } else {
        setTestPhase('complete');
        setCurrentTest(null);
      }
    }
  };

  const getAverageWpm = (results: TestResult[]) => {
    if (results.length === 0) return 0;
    const total = results.reduce((sum, result) => sum + result.wpm, 0);
    return Math.round(total / results.length);
  };

  const handleComplete = () => {
    const normalAvg = getAverageWpm(normalResults);
    const skimmingAvg = getAverageWpm(skimmingResults);
    
    localStorage.setItem('userWpmData', JSON.stringify({
      username,
      normalWpm: normalAvg,
      skimmingWpm: skimmingAvg,
      timestamp: Date.now(),
      normalResults,
      skimmingResults
    }));
    
    onComplete(normalAvg, skimmingAvg);
  };

  const isNormalComplete = normalResults.length === NORMAL_TEXTS.length;
  const isSkimmingComplete = skimmingResults.length === SKIMMING_TEXTS.length;
  const canProceed = isNormalComplete && isSkimmingComplete;

  return (
    <div className="min-h-screen bg-white">
      <div className="h-screen max-w-4xl mx-auto bg-white shadow-[5px_0_15px_rgba(0,0,0,0.1),-5px_0_15px_rgba(0,0,0,0.1)] overflow-y-auto">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Welcome, {username}!
            </h1>
            <p className="text-lg text-gray-600">
              Let's measure your reading speeds to personalize your experience
            </p>
          </div>

          <div className="space-y-8">
            {/* Normal Reading Test */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Normal Reading Speed Test
              </h2>
              <p className="text-gray-600 mb-4">
                Read {NORMAL_TEXTS.length} passages at your normal reading pace. Click "Start" to begin timing each passage.
              </p>
              
              {normalResults.length > 0 && (
                <div className="mb-4 p-3 bg-gray-100 rounded-md">
                  <p className="text-gray-700 text-sm">
                    Completed: {normalResults.length}/{NORMAL_TEXTS.length} passages
                    {normalResults.map((result, i) => (
                      <span key={i} className="ml-2 text-gray-600">
                        P{i+1}: {result.wpm} WPM
                      </span>
                    ))}
                  </p>
                </div>
              )}

              {!currentTest && !isNormalComplete && (
                <button
                  onClick={() => startReading('normal')}
                  className="mb-4 bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  {normalResults.length === 0 ? 'Start Normal Reading Test' : 'Continue Normal Reading Test'}
                </button>
              )}

              {currentTest === 'normal' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-700 font-medium">
                      Passage {currentPassageIndex + 1} of {NORMAL_TEXTS.length}
                    </span>
                    {testPhase === 'ready' && (
                      <button
                        onClick={startTiming}
                        className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        Start Reading
                      </button>
                    )}
                    {testPhase === 'reading' && (
                      <button
                        onClick={finishPassage}
                        className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Finish Passage
                      </button>
                    )}
                  </div>
                  
                  {testPhase === 'reading' && (
                    <div className="mb-4 p-2 bg-green-100 rounded-md">
                      <p className="text-green-800 text-sm font-medium">Timer active - read at your normal pace</p>
                    </div>
                  )}
                </div>
              )}

              {(currentTest === 'normal' || isNormalComplete) && (
                <div className="bg-gray-100 p-4 rounded-md text-gray-800 leading-relaxed text-base mb-6">
                  {getCurrentText() || NORMAL_TEXTS[0]}
                </div>
              )}

              {isNormalComplete && (
                <div className="p-4 bg-green-100 rounded-md">
                  <p className="text-green-800 font-medium">
                    Normal reading test complete! Average: {getAverageWpm(normalResults)} WPM
                  </p>
                </div>
              )}
            </div>

            {/* Skimming Reading Test */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Skimming Speed Test
              </h2>
              <p className="text-gray-600 mb-4">
                Skim through {SKIMMING_TEXTS.length} passages quickly to get the general idea. Don't worry about understanding every detail.
              </p>
              
              {skimmingResults.length > 0 && (
                <div className="mb-4 p-3 bg-gray-100 rounded-md">
                  <p className="text-gray-700 text-sm">
                    Completed: {skimmingResults.length}/{SKIMMING_TEXTS.length} passages
                    {skimmingResults.map((result, i) => (
                      <span key={i} className="ml-2 text-gray-600">
                        P{i+1}: {result.wpm} WPM
                      </span>
                    ))}
                  </p>
                </div>
              )}

              {!currentTest && !isSkimmingComplete && (
                <button
                  onClick={() => startReading('skimming')}
                  disabled={!isNormalComplete}
                  className={`mb-4 px-6 py-2 rounded-md focus:outline-none focus:ring-2 ${
                    isNormalComplete 
                      ? 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {skimmingResults.length === 0 ? 'Start Skimming Test' : 'Continue Skimming Test'}
                </button>
              )}

              {currentTest === 'skimming' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-700 font-medium">
                      Passage {currentPassageIndex + 1} of {SKIMMING_TEXTS.length}
                    </span>
                    {testPhase === 'ready' && (
                      <button
                        onClick={startTiming}
                        className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        Start Skimming
                      </button>
                    )}
                    {testPhase === 'reading' && (
                      <button
                        onClick={finishPassage}
                        className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Finish Passage
                      </button>
                    )}
                  </div>
                  
                  {testPhase === 'reading' && (
                    <div className="mb-4 p-2 bg-purple-100 rounded-md">
                      <p className="text-purple-800 text-sm font-medium">Timer active - skim for main ideas only</p>
                    </div>
                  )}
                </div>
              )}

              {(currentTest === 'skimming' || isSkimmingComplete) && (
                <div className="bg-gray-100 p-4 rounded-md text-gray-800 leading-relaxed text-base mb-6">
                  {getCurrentText() || SKIMMING_TEXTS[0]}
                </div>
              )}

              {isSkimmingComplete && (
                <div className="p-4 bg-green-100 rounded-md">
                  <p className="text-green-800 font-medium">
                    Skimming test complete! Average: {getAverageWpm(skimmingResults)} WPM
                  </p>
                </div>
              )}
            </div>

            {/* Complete Button */}
            {canProceed && (
              <div className="text-center">
                <button
                  onClick={handleComplete}
                  className="bg-gray-700 text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Continue to Reading App
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;