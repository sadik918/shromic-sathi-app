import type { WorkerContact, WorkerContactCategory } from '../types';
import { toEnglishDigits, toBengaliDigits } from './calculations';

/**
 * Normalizes a Bangladeshi or international phone number into standard English digits.
 * Strips formatting, whitespace, dashes, parenthetical area codes, and standardizes
 * +8801XXXXXXXXX / 8801XXXXXXXXX / 01XXXXXXXXX into clean standard 11-digit format (01XXXXXXXXX)
 * or international format for foreign/hotline numbers.
 */
export function normalizeBDPhoneNumber(phone: string): string {
  if (!phone) return '';
  const eng = toEnglishDigits(String(phone).trim());
  const clean = eng.replace(/[^\d+]/g, '');

  // Extract pure digits
  const pureDigits = clean.replace(/\D/g, '');

  // Standard Bangladeshi mobile: 8801XXXXXXXXX (13 digits) -> 01XXXXXXXXX (11 digits)
  if (pureDigits.startsWith('8801') && pureDigits.length === 13) {
    return pureDigits.slice(2);
  }

  // +8801XXXXXXXXX -> 01XXXXXXXXX
  if (clean.startsWith('+8801') && pureDigits.length === 13) {
    return pureDigits.slice(2);
  }

  // 01XXXXXXXXX (11 digits)
  if (pureDigits.startsWith('01') && pureDigits.length === 11) {
    return pureDigits;
  }

  // Hotlines or standard numbers
  if (pureDigits.length > 0 && pureDigits.length <= 5) {
    return pureDigits;
  }

  return clean.startsWith('+') ? `+${pureDigits}` : pureDigits;
}

/**
 * Formats a phone number in standard English digits.
 * Always returns English numerals (0-9), never Bengali numerals.
 * Example: 01712345678 or 01712-345678
 */
export function toEnglishDisplayPhone(phone: string, formatted = false): string {
  if (!phone) return '';
  const eng = toEnglishDigits(String(phone).trim()).replace(/[^\d+]/g, '');
  const normalized = normalizeBDPhoneNumber(eng);

  if (formatted && normalized.startsWith('01') && normalized.length === 11) {
    return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
  }
  return normalized || eng;
}

/**
 * Checks if two contacts represent the same person / phone number.
 */
export function isDuplicateContact(a: WorkerContact, b: WorkerContact): boolean {
  if (a.id === b.id) return false;

  const phoneA = normalizeBDPhoneNumber(a.phone);
  const phoneB = normalizeBDPhoneNumber(b.phone);

  // If both have valid normalized phone numbers and they match
  if (phoneA && phoneB && phoneA === phoneB) {
    return true;
  }

  // If same trimmed lowercase full name and same non-empty phone digits
  const nameA = a.fullName.trim().toLowerCase();
  const nameB = b.fullName.trim().toLowerCase();
  if (nameA && nameB && nameA === nameB && phoneA && phoneB && phoneA === phoneB) {
    return true;
  }

  return false;
}

/**
 * Merges two contact objects into one, preserving all meaningful data.
 */
export function mergeTwoContacts(primary: WorkerContact, secondary: WorkerContact): WorkerContact {
  // Choose the best full name (longer, more complete)
  const namePrimary = primary.fullName.trim();
  const nameSecondary = secondary.fullName.trim();
  const fullName = nameSecondary.length > namePrimary.length ? nameSecondary : namePrimary;

  // Phone in clean English format
  const phone = toEnglishDisplayPhone(primary.phone || secondary.phone);

  // Designation: prefer meaningful over empty or "ফ্রম গুগল"
  const desPrimary = (primary.designation || '').trim();
  const desSecondary = (secondary.designation || '').trim();
  let designation = desPrimary;
  if (!designation || designation === 'ফ্রম গুগল' || designation === 'From Google') {
    if (desSecondary && desSecondary !== 'ফ্রম গুগল' && desSecondary !== 'From Google') {
      designation = desSecondary;
    } else {
      designation = designation || desSecondary;
    }
  }

  // Department
  const department = (primary.department || secondary.department || '').trim();

  // Line Number
  const lineNumber = (primary.lineNumber || secondary.lineNumber || '').trim();

  // Category and customCategory
  let category = primary.category;
  let customCategory = primary.customCategory || secondary.customCategory;
  if (primary.category === 'google' && secondary.category && secondary.category !== 'google') {
    category = secondary.category;
  } else if (primary.category === 'other' && secondary.category && secondary.category !== 'other') {
    category = secondary.category;
  }

  // Notes: combine if distinct
  const noteA = (primary.notes || '').trim();
  const noteB = (secondary.notes || '').trim();
  let notes = noteA;
  if (noteB && noteB !== noteA) {
    notes = noteA ? `${noteA} | ${noteB}` : noteB;
  }

  // Boolean flags
  const isPinned = Boolean(primary.isPinned || secondary.isPinned);
  const isFavorite = Boolean(primary.isFavorite || secondary.isFavorite);
  const isEmergency = Boolean(primary.isEmergency || secondary.isEmergency);
  const isSyncedToGoogle = Boolean(primary.isSyncedToGoogle || secondary.isSyncedToGoogle);
  const googleResourceName = primary.googleResourceName || secondary.googleResourceName;
  const source = primary.source === 'google' || secondary.source === 'google' ? 'google' : (primary.source || 'manual');

  return {
    ...primary,
    fullName,
    phone,
    designation: designation || undefined,
    department: department || undefined,
    lineNumber: lineNumber || undefined,
    category,
    customCategory: customCategory || undefined,
    notes: notes || undefined,
    isPinned,
    isFavorite,
    isEmergency,
    isSyncedToGoogle,
    googleResourceName,
    source,
    updatedAt: new Date().toISOString(),
  };
}

export interface DeduplicateResult {
  mergedContacts: WorkerContact[];
  duplicateIdsToRemove: string[];
  duplicateCount: number;
}

/**
 * Scans a list of contacts and deduplicates records that have matching phone numbers.
 * Returns the cleaned list, the list of redundant IDs that can be deleted from DB,
 * and the count of duplicates eliminated.
 */
export function deduplicateContactsList(contacts: WorkerContact[]): DeduplicateResult {
  const duplicateIdsToRemove: string[] = [];
  const phoneMap = new Map<string, WorkerContact>();
  const nonPhoneList: WorkerContact[] = [];

  for (const contact of contacts) {
    const normPhone = normalizeBDPhoneNumber(contact.phone);
    if (!normPhone) {
      nonPhoneList.push(contact);
      continue;
    }

    if (phoneMap.has(normPhone)) {
      const existing = phoneMap.get(normPhone)!;
      const merged = mergeTwoContacts(existing, contact);
      phoneMap.set(normPhone, merged);
      duplicateIdsToRemove.push(contact.id);
    } else {
      phoneMap.set(normPhone, contact);
    }
  }

  const mergedContacts = [...Array.from(phoneMap.values()), ...nonPhoneList];
  return {
    mergedContacts,
    duplicateIdsToRemove,
    duplicateCount: duplicateIdsToRemove.length,
  };
}

/**
 * Smart Search: bidirectional search supporting both Bengali and English digits,
 * names, designations, department, line number, notes, category, and custom category.
 * Always sorts pinned contacts (`isPinned === true`) to the very top.
 */
export function smartSearchContacts(
  contacts: WorkerContact[],
  searchQuery: string,
  selectedCategory: string = 'all'
): WorkerContact[] {
  const trimmed = searchQuery.trim().toLowerCase();
  const qEng = toEnglishDigits(trimmed);
  const qBn = toBengaliDigits(trimmed);

  const matched = contacts.filter((c) => {
    // 1. Category Filter
    if (selectedCategory === 'favorites') {
      if (!c.isFavorite) return false;
    } else if (selectedCategory === 'emergency') {
      if (!c.isEmergency && c.category !== 'emergency') return false;
    } else if (selectedCategory !== 'all') {
      const matchCat = c.category === selectedCategory || (c.customCategory && c.customCategory.toLowerCase() === selectedCategory.toLowerCase());
      if (!matchCat) return false;
    }

    // 2. Query Search
    if (!trimmed) return true;

    const name = (c.fullName || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    const phoneNormalized = normalizeBDPhoneNumber(c.phone);
    const designation = (c.designation || '').toLowerCase();
    const department = (c.department || '').toLowerCase();
    const lineNumber = (c.lineNumber || '').toLowerCase();
    const notes = (c.notes || '').toLowerCase();
    const customCat = (c.customCategory || '').toLowerCase();

    // Check name
    if (name.includes(trimmed)) return true;

    // Check phone (both english and bengali digit representations)
    if (
      phone.includes(trimmed) ||
      phone.includes(qEng) ||
      phone.includes(qBn) ||
      phoneNormalized.includes(qEng)
    ) {
      return true;
    }

    // Check designation / job title
    if (designation.includes(trimmed)) return true;

    // Check department
    if (department.includes(trimmed)) return true;

    // Check line number
    if (lineNumber.includes(trimmed) || lineNumber.includes(qEng) || lineNumber.includes(qBn)) {
      return true;
    }

    // Check notes
    if (notes.includes(trimmed)) return true;

    // Check custom category
    if (customCat.includes(trimmed)) return true;

    return false;
  });

  // Sort matched contacts: Pinned contacts first, then Favorites, then default order
  return matched.sort((a, b) => {
    const pinA = a.isPinned ? 1 : 0;
    const pinB = b.isPinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;

    const favA = a.isFavorite ? 1 : 0;
    const favB = b.isFavorite ? 1 : 0;
    if (favA !== favB) return favB - favA;

    return 0;
  });
}

