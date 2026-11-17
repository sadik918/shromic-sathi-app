export type PreviewListVariant = 'overtime' | 'attendance';

/**
 * Computes responsive preview limits for long lists so that:
 * - Mobile view stays compact and comfortable to scroll with one hand.
 * - Desktop view aligns balanced column heights alongside adjacent forms/calendars.
 */
export function getResponsiveListPreviewLimit(
  viewportWidth: number,
  variant: PreviewListVariant
): number {
  const isDesktop = viewportWidth >= 768;
  if (variant === 'overtime') {
    return isDesktop ? 4 : 3;
  }
  return isDesktop ? 6 : 5;
}

export interface SlicedPreviewResult<T> {
  visibleItems: T[];
  hiddenCount: number;
  hasMore: boolean;
}

/**
 * Slices a list according to its expanded state and preview limit.
 */
export function slicePreviewRecords<T>(
  items: readonly T[],
  expanded: boolean,
  previewLimit: number
): SlicedPreviewResult<T> {
  const safeLimit = Math.max(1, Math.floor(previewLimit));
  const hasMore = items.length > safeLimit;

  if (expanded || !hasMore) {
    return {
      visibleItems: [...items],
      hiddenCount: 0,
      hasMore,
    };
  }

  return {
    visibleItems: items.slice(0, safeLimit),
    hiddenCount: items.length - safeLimit,
    hasMore: true,
  };
}
