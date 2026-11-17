import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSupportTicketCounts,
  filterWorkerFeedback,
  getFeedbackCategoryLabel,
  SUPPORT_CATEGORIES,
  SUPPORT_FAQS,
  SUPPORT_QUICK_PROMPTS,
} from './supportHelpers';
import type { SupportFeedback } from '../types';
import type { SupportTicketRecord } from './adminLogic';

describe('Support & Feedback Pure Helpers', () => {
  it('exposes clean non-empty categories, quick prompts, and FAQs', () => {
    assert.equal(SUPPORT_CATEGORIES.length, 4);
    assert.ok(SUPPORT_QUICK_PROMPTS.length >= 4);
    assert.ok(SUPPORT_FAQS.length >= 3);
    assert.equal(getFeedbackCategoryLabel('calculation_help', 'bn'), 'বেতন ও ওভারটাইম হিসাব');
    assert.equal(getFeedbackCategoryLabel('bug_report', 'en'), 'Technical Issue');
  });

  it('filters worker feedback cleanly by status and query', () => {
    const list: SupportFeedback[] = [
      {
        id: 'fb_1',
        userId: 'u1',
        workerName: 'রহিম',
        category: 'calculation_help',
        message: 'আমার ওভারটাইম হিসাব মিলছে না',
        status: 'open',
      },
      {
        id: 'fb_2',
        userId: 'u1',
        workerName: 'রহিম',
        category: 'bug_report',
        message: 'অফলাইন ডেটা সিঙ্ক হচ্ছে না',
        status: 'resolved',
      },
    ];

    assert.equal(filterWorkerFeedback(list, 'all').length, 2);
    assert.equal(filterWorkerFeedback(list, 'open').length, 1);
    assert.equal(filterWorkerFeedback(list, 'resolved').length, 1);
    assert.equal(filterWorkerFeedback(list, 'all', 'ওভারটাইম').length, 1);
    assert.equal(filterWorkerFeedback(list, 'resolved', 'ওভারটাইম').length, 0);
  });

  it('computes accurate Admin support ticket KPI counts', () => {
    const sampleTickets = [
      { id: 't1', status: 'new' },
      { id: 't2', status: 'in_progress' },
      { id: 't3', status: 'waiting_for_user' },
      { id: 't4', status: 'resolved' },
      { id: 't5', status: 'closed' },
    ] as unknown as SupportTicketRecord[];

    const counts = computeSupportTicketCounts(sampleTickets);
    assert.equal(counts.total, 5);
    assert.equal(counts.newCount, 1);
    assert.equal(counts.inProgress, 2);
    assert.equal(counts.resolved, 2);
  });
});
