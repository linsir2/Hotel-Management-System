import { useState, useCallback } from 'react';

interface AISearchResult {
  intent?: string;
  intent_display?: string;
  matched_category?: string;
  table: string; // 'rooms' | 'bookings' | 'guests'
  results: any[];
  count?: number;
  candidates?: { intent: string; table: string; label: string }[];
  error?: string;
}

/**
 * Shared hook for AI-powered NL search.
 * Debounces and calls POST /api/ai/search.
 * Each page uses this alongside its normal local filter logic.
 */
export function useAISearch() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<AISearchResult | null>(null);
  const [aiAmbiguity, setAiAmbiguity] = useState<AISearchResult['candidates'] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const toggleAi = useCallback(() => {
    setAiEnabled(prev => {
      if (prev) {
        // Turning off — clear AI state
        setAiResults(null);
        setAiAmbiguity(null);
      }
      return !prev;
    });
  }, []);

  const aiSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 1) {
      setAiResults(null);
      setAiAmbiguity(null);
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      console.log('[AI Search] status:', res.status, 'ok:', res.ok);
      const data = await res.json();
      console.log('[AI Search] response:', JSON.stringify({table: data.table, mode: data.mode, count: data.count, error: data.error}));

      if (data.error) {
        setAiError(data.error);
        setAiResults(null);
        setAiAmbiguity(null);
      } else if (data.ambiguity && data.candidates?.length > 1) {
        setAiAmbiguity(data.candidates);
        setAiResults(null);
        setAiError(null);
      } else {
        setAiResults(data);
        setAiAmbiguity(null);
        setAiError(null);
      }
    } catch (err: any) {
      console.error('[AI Search] fetch failed:', err.message);
      setAiError(`网络错误: ${err.message}`);
      setAiResults(null);
      setAiAmbiguity(null);
    } finally {
      setAiLoading(false);
    }
  }, []);

  return {
    aiEnabled,
    aiLoading,
    aiResults,
    aiAmbiguity,
    aiError,
    toggleAi,
    aiSearch,
  };
}
