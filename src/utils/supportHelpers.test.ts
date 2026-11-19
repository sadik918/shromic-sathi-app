import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSupportTicketCounts,
  filterActivePublishedAnnouncements,
  filterWorkerFeedback,
  getFeedbackCategoryLabel,
  getSupportStatusMeta,
  mergeSupportReplies,
  sortSupportFeedbackNewestFirst,
  SUPPORT_CATEGORIES,
  SUPPORT_FAQS,
  SUPPORT_QUICK_PROMPTS,
} from './supportHelpers';
import type { SupportFeedback } from '../types';
import type { PlatformAnnouncement, SupportTicketRecord } from './adminLogic';

describe('Support & Feedback Pure Helpers', () => {
  it('exposes clean non-empty categories, quick prompts, and FAQs', () => {
    assert.equal(SUPPORT_CATEGORIES.length, 4);
    assert.ok(SUPPORT_QUICK_PROMPTS.length >= 4);
    assert.ok(SUPPORT_FAQS.length >= 3);
    assert.equal(getFeedbackCategoryLabel('calculation_help', 'bn'), 'বেতন ও ওভারটাইম হিসাব');
    assert.equal(getFeedbackCategoryLabel('bug_report', 'en'), 'Technical Issue');
  });

  it('filters worker feedback cleanly by status, adminStatus, and query', () => {
    const list: SupportFeedback[] = [
      {
        id: 'fb_1',
        userId: 'u1',
        workerName: 'রহিম',
        category: 'calculation_help',
        message: 'আমার ওভারটাইম হিসাব মিলছে না',
        status: 'open',
        createdAt: '2026-10-20T08:00:00Z',
      },
      {
        id: 'fb_2',
        userId: 'u1',
        workerName: 'রহিম',
        category: 'bug_report',
        message: 'অফলাইন ডেটা সিঙ্ক হচ্ছে না',
        status: 'resolved',
        createdAt: '2026-10-22T08:00:00Z',
      },
      {
        id: 'fb_3',
        userId: 'u1',
        workerName: 'রহিম',
        category: 'general',
        message: 'বন্ধ টিকিট',
        status: 'open',
        adminStatus: 'closed',
        createdAt: '2026-10-25T08:00:00Z',
      },
    ];

    const all = filterWorkerFeedback(list, 'all');
    assert.equal(all.length, 3);
    assert.equal(all[0].id, 'fb_3');
    assert.equal(filterWorkerFeedback(list, 'open').length, 1);
    assert.equal(filterWorkerFeedback(list, 'resolved').length, 2);
    assert.equal(filterWorkerFeedback(list, 'all', 'ওভারটাইম').length, 1);
    assert.equal(filterWorkerFeedback(list, 'resolved', 'ওভারটাইম').length, 0);
  });

  it('sorts feedback newest-first across ISO strings and Firestore-like timestamps', () => {
    const sorted = sortSupportFeedbackNewestFirst([
      {
        id: 'old',
        userId: 'u1',
        workerName: 'A',
        category: 'general',
        message: 'old',
        status: 'open',
        createdAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'newest_firestore',
        userId: 'u1',
        workerName: 'A',
        category: 'general',
        message: 'new',
        status: 'open',
        updatedAt: { seconds: 1793500000 },
      },
      {
        id: 'middle',
        userId: 'u1',
        workerName: 'A',
        category: 'general',
        message: 'mid',
        status: 'open',
        createdAt: '2026-10-15T10:00:00Z',
      },
    ]);
    assert.deepEqual(
      sorted.map((x) => x.id),
      ['newest_firestore', 'middle', 'old']
    );
  });

  it('merges primary and secondary support replies without duplicates while preserving authorRole', () => {
    const merged = mergeSupportReplies(
      [
        { id: 'r1', authorName: 'Admin', authorRole: 'admin', message: 'হ্যালো', createdAt: '2026-10-28 10:00' },
      ],
      [
        { id: 'r1', authorName: 'Admin', message: 'হ্যালো', createdAt: '2026-10-28 10:00' },
        { id: 'r2', authorName: 'রহিম', authorRole: 'user', message: 'ধন্যবাদ', createdAt: '2026-10-28 10:05' },
      ]
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].authorRole, 'admin');
    assert.equal(merged[1].authorRole, 'user');
  });

  it('resolves localized status metadata for all ticket states', () => {
    assert.equal(getSupportStatusMeta({ status: 'open' }, 0, 'bn').label, 'অপেক্ষমাণ');
    assert.equal(getSupportStatusMeta({ status: 'open' }, 1, 'bn').label, 'উত্তর দেওয়া হয়েছে');
    assert.equal(
      getSupportStatusMeta({ status: 'open', adminStatus: 'waiting_for_user' }, 1, 'bn').label,
      'আপনার উত্তরের অপেক্ষায়'
    );
    assert.equal(
      getSupportStatusMeta({ status: 'resolved', adminStatus: 'resolved' }, 1, 'bn').label,
      'সমাধান হয়েছে'
    );
    assert.equal(
      getSupportStatusMeta({ status: 'resolved', adminStatus: 'closed' }, 1, 'bn').label,
      'বন্ধ করা হয়েছে'
    );
  });

  it('filters active published announcements and excludes drafts, archived, or expired notices', () => {
    const announcements: PlatformAnnouncement[] = [
      {
        id: 'ann_active_new',
        titleBn: 'নতুন আপডেট',
        titleEn: 'New Update',
        messageBn: 'বিস্তারিত বার্তা',
        messageEn: 'Details',
        category: 'important_update',
        status: 'published',
        audience: 'all',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        publishedBy: 'admin@example.com',
        publishedAt: '2026-10-28',
        createdAt: '2026-10-28',
        updatedAt: '2026-10-28',
      },
      {
        id: 'ann_draft',
        titleBn: 'খসড়া',
        titleEn: 'Draft',
        messageBn: 'খসড়া বার্তা',
        messageEn: 'Draft msg',
        category: 'general',
        status: 'draft',
        audience: 'all',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        publishedBy: 'admin@example.com',
        createdAt: '2026-10-27',
        updatedAt: '2026-10-27',
      },
      {
        id: 'ann_expired',
        titleBn: 'পুরানো নোটিশ',
        titleEn: 'Expired',
        messageBn: 'মেয়াদ শেষ',
        messageEn: 'Expired',
        category: 'general',
        status: 'published',
        audience: 'all',
        startDate: '2026-01-01',
        endDate: '2026-09-30',
        publishedBy: 'admin@example.com',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];
    const active = filterActivePublishedAnnouncements(announcements, '2026-10-28');
    assert.equal(active.length, 1);
    assert.equal(active[0].id, 'ann_active_new');
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
