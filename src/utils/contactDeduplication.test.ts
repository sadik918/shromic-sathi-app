import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBDPhoneNumber,
  toEnglishDisplayPhone,
  isDuplicateContact,
  mergeTwoContacts,
  deduplicateContactsList,
  smartSearchContacts,
} from './contactDeduplication';
import type { WorkerContact } from '../types';

describe('Contact Deduplication & Auto-Merge Logic', () => {
  test('normalizeBDPhoneNumber handles various BD phone formats', () => {
    assert.equal(normalizeBDPhoneNumber('01712345678'), '01712345678');
    assert.equal(normalizeBDPhoneNumber('+8801712345678'), '01712345678');
    assert.equal(normalizeBDPhoneNumber('8801712345678'), '01712345678');
    assert.equal(normalizeBDPhoneNumber('01712-345678'), '01712345678');
    // Bengali digits to standard English
    assert.equal(normalizeBDPhoneNumber('০১৭১২৩৪৫৬৭৮'), '01712345678');
    assert.equal(normalizeBDPhoneNumber('+৮৮০১৭১২৩৪৫৬৭৮'), '01712345678');
    // Hotlines
    assert.equal(normalizeBDPhoneNumber('999'), '999');
    assert.equal(normalizeBDPhoneNumber('৯৯৯'), '999');
  });

  test('toEnglishDisplayPhone always produces English digits', () => {
    assert.equal(toEnglishDisplayPhone('০১৭১২৩৪৫৬৭৮'), '01712345678');
    assert.equal(toEnglishDisplayPhone('+8801712345678'), '01712345678');
    assert.equal(toEnglishDisplayPhone('01812345678', true), '01812-345678');
  });

  test('isDuplicateContact identifies matching phones across formats', () => {
    const c1: WorkerContact = {
      id: 'c1',
      userId: 'u1',
      fullName: 'রফিক আহমেদ',
      phone: '01712345678',
      category: 'coworker',
      isFavorite: false,
      isEmergency: false,
    };
    const c2: WorkerContact = {
      id: 'c2',
      userId: 'u1',
      fullName: 'রফিক আহমেদ (সুইং)',
      phone: '+8801712345678',
      category: 'supervisor',
      isFavorite: true,
      isEmergency: false,
    };
    const c3: WorkerContact = {
      id: 'c3',
      userId: 'u1',
      fullName: 'অন্য কর্মী',
      phone: '01899999999',
      category: 'coworker',
      isFavorite: false,
      isEmergency: false,
    };

    assert.equal(isDuplicateContact(c1, c2), true);
    assert.equal(isDuplicateContact(c1, c3), false);
  });

  test('mergeTwoContacts preserves the best fields and flags', () => {
    const primary: WorkerContact = {
      id: 'c1',
      userId: 'u1',
      fullName: 'সোহেল',
      phone: '০১৭১২৩৪৫৬৭৮',
      designation: 'ফ্রম গুগল',
      category: 'google',
      isFavorite: false,
      isEmergency: false,
      notes: 'গুগল কন্ট্যাক্ট',
    };

    const secondary: WorkerContact = {
      id: 'c2',
      userId: 'u1',
      fullName: 'মোঃ সোহেল রানা',
      phone: '01712345678',
      designation: 'সুপারভাইজার',
      category: 'supervisor',
      department: 'সুইং সেকশন',
      lineNumber: 'লাইন ১২',
      isFavorite: true,
      isEmergency: true,
      notes: 'লাইন প্রধান',
    };

    const merged = mergeTwoContacts(primary, secondary);
    assert.equal(merged.fullName, 'মোঃ সোহেল রানা');
    assert.equal(merged.phone, '01712345678'); // in English digits!
    assert.equal(merged.designation, 'সুপারভাইজার'); // preferred over "ফ্রম গুগল"
    assert.equal(merged.department, 'সুইং সেকশন');
    assert.equal(merged.lineNumber, 'লাইন ১২');
    assert.equal(merged.category, 'supervisor');
    assert.equal(merged.isFavorite, true);
    assert.equal(merged.isEmergency, true);
    assert.ok(merged.notes?.includes('গুগল কন্ট্যাক্ট'));
    assert.ok(merged.notes?.includes('লাইন প্রধান'));
  });

  test('deduplicateContactsList removes duplicate entries and returns cleaned list', () => {
    const list: WorkerContact[] = [
      {
        id: '1',
        userId: 'u1',
        fullName: 'আলমগীর',
        phone: '01711111111',
        category: 'coworker',
        isFavorite: false,
        isEmergency: false,
      },
      {
        id: '2',
        userId: 'u1',
        fullName: 'আলমগীর হোসেন',
        phone: '+8801711111111',
        category: 'line_chief',
        designation: 'লাইন চিফ',
        isFavorite: true,
        isEmergency: false,
      },
      {
        id: '3',
        userId: 'u1',
        fullName: 'বশির আহমেদ',
        phone: '01822222222',
        category: 'coworker',
        isFavorite: false,
        isEmergency: false,
      },
      {
        id: '4',
        userId: 'u1',
        fullName: 'বশির আহমেদ',
        phone: '০১৮২২২২২২২২',
        category: 'coworker',
        isFavorite: false,
        isEmergency: true,
      },
    ];

    const result = deduplicateContactsList(list);
    assert.equal(result.mergedContacts.length, 2);
    assert.equal(result.duplicateCount, 2);
    assert.deepEqual(result.duplicateIdsToRemove, ['2', '4']);

    // Check merged properties
    const alamgir = result.mergedContacts.find((c) => c.phone === '01711111111')!;
    assert.ok(alamgir);
    assert.equal(alamgir.fullName, 'আলমগীর হোসেন');
    assert.equal(alamgir.designation, 'লাইন চিফ');
    assert.equal(alamgir.isFavorite, true);

    const bashir = result.mergedContacts.find((c) => c.phone === '01822222222')!;
    assert.ok(bashir);
    assert.equal(bashir.isEmergency, true);
  });

  test('smartSearchContacts searches bidirectionally in English and Bengali digits', () => {
    const list: WorkerContact[] = [
      {
        id: '1',
        userId: 'u1',
        fullName: 'সোহেল রানা',
        phone: '01712345678',
        designation: 'সিনিয়র অপারেটর',
        department: 'সুইং',
        lineNumber: 'লাইন-৪',
        category: 'coworker',
        isFavorite: true,
        isEmergency: false,
      },
      {
        id: '2',
        userId: 'u1',
        fullName: 'ফারুক হোসেন',
        phone: '01898765432',
        designation: 'মেকানিক',
        category: 'other',
        customCategory: 'হেড মেকানিক',
        isFavorite: false,
        isEmergency: true,
      },
    ];

    // Search by English digits for phone
    const res1 = smartSearchContacts(list, '01712');
    assert.equal(res1.length, 1);
    assert.equal(res1[0].fullName, 'সোহেল রানা');

    // Search by Bengali digits for phone
    const res2 = smartSearchContacts(list, '০১৭১২');
    assert.equal(res2.length, 1);
    assert.equal(res2[0].fullName, 'সোহেল রানা');

    // Search by line number
    const res3 = smartSearchContacts(list, 'লাইন-৪');
    assert.equal(res3.length, 1);
    assert.equal(res3[0].fullName, 'সোহেল রানা');

    // Search by partial phone
    const resPhonePart = smartSearchContacts(list, '98765');
    assert.equal(resPhonePart.length, 1);
    assert.equal(resPhonePart[0].fullName, 'ফারুক হোসেন');

    // Search by custom category
    const res4 = smartSearchContacts(list, 'মেকানিক');
    assert.equal(res4.length, 1);
    assert.equal(res4[0].fullName, 'ফারুক হোসেন');

    // Category filter
    const resFav = smartSearchContacts(list, '', 'favorites');
    assert.equal(resFav.length, 1);
    assert.equal(resFav[0].fullName, 'সোহেল রানা');
  });

  test('smartSearchContacts places pinned contacts (isPinned = true) at the top', () => {
    const list: WorkerContact[] = [
      {
        id: '1',
        userId: 'u1',
        fullName: 'সাধারণ কন্ট্যাক্ট ১',
        phone: '01711111111',
        category: 'coworker',
        isPinned: false,
        isFavorite: true,
        isEmergency: false,
      },
      {
        id: '2',
        userId: 'u1',
        fullName: 'পিন করা কন্ট্যাক্ট',
        phone: '01722222222',
        category: 'supervisor',
        isPinned: true,
        isFavorite: false,
        isEmergency: false,
      },
      {
        id: '3',
        userId: 'u1',
        fullName: 'সাধারণ কন্ট্যাক্ট ২',
        phone: '01733333333',
        category: 'coworker',
        isPinned: false,
        isFavorite: false,
        isEmergency: false,
      },
    ];

    const results = smartSearchContacts(list, '');
    assert.equal(results.length, 3);
    assert.equal(results[0].id, '2'); // Pinned contact MUST be first
    assert.equal(results[0].fullName, 'পিন করা কন্ট্যাক্ট');
  });
});

