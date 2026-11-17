import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Language } from '../types';
import { formatNumber } from '../utils/calculations';
import { getResponsiveListPreviewLimit, type PreviewListVariant } from '../utils/listPreview';

export function useResponsiveListLimit(variant: PreviewListVariant): number {
  const [limit, setLimit] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return getResponsiveListPreviewLimit(390, variant);
    }
    return getResponsiveListPreviewLimit(window.innerWidth, variant);
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => {
      setLimit(getResponsiveListPreviewLimit(window.innerWidth, variant));
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [variant]);

  return limit;
}

interface TransparentSeeMoreFooterProps {
  expanded: boolean;
  hasMore: boolean;
  hiddenCount: number;
  lang: Language;
  onToggle: () => void;
  testId: string;
}

export const TransparentSeeMoreFooter: React.FC<TransparentSeeMoreFooterProps> = ({
  expanded,
  hasMore,
  hiddenCount,
  lang,
  onToggle,
  testId,
}) => {
  if (!hasMore) return null;

  if (!expanded) {
    return (
      <div className="relative -mt-1 pt-3 pb-0.5 flex items-center justify-center bg-gradient-to-t from-white/90 via-white/45 to-transparent dark:from-slate-900/90 dark:via-slate-900/45 dark:to-transparent rounded-b-2xl">
        <button
          type="button"
          data-testid={testId}
          aria-expanded={false}
          onClick={onToggle}
          className="min-h-[38px] px-4 py-1.5 rounded-full bg-emerald-500/8 hover:bg-emerald-500/15 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/20 backdrop-blur-md border border-emerald-500/25 dark:border-emerald-400/30 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
        >
          <span>
            {lang === 'bn'
              ? `সি মোর · আরও ${formatNumber(hiddenCount, 'bn')}টি দেখুন`
              : `See More (+${hiddenCount})`}
          </span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div className="pt-2.5 pb-0.5 flex items-center justify-center">
      <button
        type="button"
        data-testid={testId}
        aria-expanded={true}
        onClick={onToggle}
        className="min-h-[36px] px-4 py-1.5 rounded-full bg-slate-500/8 hover:bg-slate-500/15 dark:bg-slate-400/10 dark:hover:bg-slate-400/20 backdrop-blur-md border border-slate-300/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
      >
        <span>{lang === 'bn' ? 'কম দেখান' : 'Show Less'}</span>
        <ChevronUp className="w-3.5 h-3.5 shrink-0" />
      </button>
    </div>
  );
};
