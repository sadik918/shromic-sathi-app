import test from 'node:test';
import assert from 'node:assert/strict';
import { getResponsiveListPreviewLimit, slicePreviewRecords } from './listPreview';

test('returns balanced preview limits for mobile and desktop viewports', () => {
  assert.equal(getResponsiveListPreviewLimit(390, 'overtime'), 3);
  assert.equal(getResponsiveListPreviewLimit(767, 'overtime'), 3);
  assert.equal(getResponsiveListPreviewLimit(768, 'overtime'), 4);
  assert.equal(getResponsiveListPreviewLimit(1440, 'overtime'), 4);

  assert.equal(getResponsiveListPreviewLimit(390, 'attendance'), 5);
  assert.equal(getResponsiveListPreviewLimit(767, 'attendance'), 5);
  assert.equal(getResponsiveListPreviewLimit(768, 'attendance'), 6);
  assert.equal(getResponsiveListPreviewLimit(1440, 'attendance'), 6);
});

test('slices records cleanly when collapsed vs expanded and computes hiddenCount', () => {
  const items = [1, 2, 3, 4, 5, 6, 7];

  const collapsed = slicePreviewRecords(items, false, 3);
  assert.deepEqual(collapsed.visibleItems, [1, 2, 3]);
  assert.equal(collapsed.hiddenCount, 4);
  assert.equal(collapsed.hasMore, true);

  const expanded = slicePreviewRecords(items, true, 3);
  assert.deepEqual(expanded.visibleItems, items);
  assert.equal(expanded.hiddenCount, 0);
  assert.equal(expanded.hasMore, true);
});

test('handles lists shorter than or equal to previewLimit without Show More trigger', () => {
  const shortList = ['a', 'b', 'c'];
  const result = slicePreviewRecords(shortList, false, 3);
  assert.deepEqual(result.visibleItems, shortList);
  assert.equal(result.hiddenCount, 0);
  assert.equal(result.hasMore, false);

  const empty = slicePreviewRecords([], false, 5);
  assert.deepEqual(empty.visibleItems, []);
  assert.equal(empty.hiddenCount, 0);
  assert.equal(empty.hasMore, false);
});
