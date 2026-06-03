import React from 'react';
import { Sparkles } from 'lucide-react';

interface Props {
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
}

/**
 * Toggle chip that switches between normal search and AI-powered NL search.
 * Renders next to existing search bars — patch, not replace.
 * When disabled, shows a subtle "试试 AI" hint. When enabled, turns purple.
 */
const AISearchToggle = ({ enabled, onToggle, loading }: Props) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={`
        flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold
        transition-all duration-200 border whitespace-nowrap select-none
        ${enabled
          ? 'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-200 scale-105'
          : 'bg-white text-purple-500 border-purple-300 hover:bg-purple-50 hover:border-purple-400 hover:scale-105'
        }
        ${loading ? 'animate-pulse cursor-wait' : 'cursor-pointer active:scale-95'}
      `}
      title={enabled ? 'AI智能搜索已开启 — 用自然语言描述你要找什么' : '切换到AI智能搜索 — 用自然语言搜索'}
    >
      <Sparkles className={`w-3.5 h-3.5 ${enabled ? 'text-yellow-300' : 'text-purple-400'}`} />
      <span>{enabled ? 'AI 搜索中' : 'AI 搜索'}</span>
    </button>
  );
};

export default AISearchToggle;
