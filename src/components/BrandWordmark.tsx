import React from 'react';

interface BrandWordmarkProps {
  size?: 'header' | 'lg';
  dataTestId?: string;
  className?: string;
}

/**
 * Custom transparent-background brand wordmark for "শ্রমিক সাথী".
 * Adapts seamlessly to both Light Mode and Night Mode without any white box background,
 * featuring larger, vibrant, luminous Bengali typography with generous vertical line-height
 * so Bengali ascenders (ি / ী) never clip.
 */
export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  size = 'header',
  dataTestId,
  className = '',
}) => {
  const isLarge = size === 'lg';

  return (
    <span
      data-testid={dataTestId}
      aria-label="শ্রমিক সাথী"
      className={`inline-flex flex-col justify-center select-none bg-transparent shrink-0 ${className}`}
    >
      <span
        className={`inline-flex items-baseline gap-1.5 font-extrabold tracking-tight leading-[1.35] ${
          isLarge
            ? 'text-2xl sm:text-3xl'
            : 'text-[21px] sm:text-2xl md:text-[27px]'
        } drop-shadow-[0_1px_1px_rgba(0,0,0,0.06)] dark:drop-shadow-[0_2px_12px_rgba(52,211,153,0.45)]`}
      >
        <span className="inline-block pt-1 pb-0.5 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 dark:from-emerald-300 dark:via-teal-200 dark:to-emerald-300 bg-clip-text text-transparent">
          শ্রমিক
        </span>
        <span className="inline-block pt-1 pb-0.5 bg-gradient-to-r from-teal-600 via-emerald-600 to-amber-600 dark:from-amber-300 dark:via-yellow-200 dark:to-emerald-300 bg-clip-text text-transparent">
          সাথী
        </span>
      </span>
    </span>
  );
};
