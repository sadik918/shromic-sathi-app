import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import type { WorkerContact } from '../types';

export interface FetchedGoogleContact {
  resourceName: string;
  fullName: string;
  phone: string;
  designation?: string;
  department?: string;
  notes?: string;
  email?: string;
}

// In-memory token cache (Do NOT store in localStorage per security guidelines)
let cachedAccessToken: string | null = null;
let tokenExpiryTime: number | null = null;

// Clear cached token when auth state changes (e.g., on sign out)
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
    tokenExpiryTime = null;
  }
});

/**
 * Requests or retrieves a cached OAuth access token for Google Contacts API.
 * Uses scope https://www.googleapis.com/auth/contacts (full read & write access).
 */
export async function getGoogleContactsAccessToken(forceInteractive = false): Promise<string | null> {
  const now = Date.now();
  if (!forceInteractive && cachedAccessToken && tokenExpiryTime && now < tokenExpiryTime) {
    return cachedAccessToken;
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/contacts');

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (accessToken) {
    cachedAccessToken = accessToken;
    // Cache for 50 minutes (Google OAuth tokens typically last 60 minutes)
    tokenExpiryTime = Date.now() + 50 * 60 * 1000;
    return accessToken;
  }

  return null;
}

export function clearGoogleContactsCache() {
  cachedAccessToken = null;
  tokenExpiryTime = null;
}

/**
 * Fetches connections (contacts) from Google People API with designation, organizations, and details.
 */
export async function fetchGoogleContacts(accessToken: string): Promise<FetchedGoogleContact[]> {
  const fields = 'names,phoneNumbers,organizations,occupations,biographies,emailAddresses';
  const url = `https://people.googleapis.com/v1/people/me/connections?personFields=${encodeURIComponent(
    fields
  )}&pageSize=300`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Google Contacts API error (${res.status}): ${res.statusText} ${errorBody}`);
  }

  const data = await res.json();
  const connections: any[] = data.connections || [];
  const results: FetchedGoogleContact[] = [];

  for (const person of connections) {
    const displayName =
      person.names?.[0]?.displayName ||
      [person.names?.[0]?.givenName, person.names?.[0]?.familyName].filter(Boolean).join(' ');

    const phone = person.phoneNumbers?.[0]?.value;

    if (phone && phone.trim().length > 0) {
      const org = person.organizations?.[0];
      const orgTitle = org?.title?.trim() || '';
      const occupation = person.occupations?.[0]?.value?.trim() || '';
      const designation = orgTitle || occupation;
      const department = org?.department?.trim() || '';
      const notes = person.biographies?.[0]?.value?.trim() || '';
      const email = person.emailAddresses?.[0]?.value || '';

      results.push({
        resourceName: person.resourceName || '',
        fullName: displayName || phone,
        phone: phone.trim(),
        designation: designation || undefined,
        department: department || undefined,
        notes: notes || undefined,
        email: email || undefined,
      });
    }
  }

  return results;
}

/**
 * Uploads a single contact to the user's connected Google Account using People API createContact.
 */
export async function createContactOnGoogle(
  accessToken: string,
  contact: {
    fullName: string;
    phone: string;
    designation?: string;
    department?: string;
    notes?: string;
  }
): Promise<{ success: boolean; resourceName?: string; error?: string }> {
  try {
    const trimmedName = contact.fullName.trim();
    const nameParts = trimmedName.split(/\s+/);
    const givenName = nameParts[0] || trimmedName;
    const familyName = nameParts.slice(1).join(' ') || undefined;

    const body: Record<string, any> = {
      names: [
        {
          givenName,
          ...(familyName ? { familyName } : {}),
        },
      ],
      phoneNumbers: [
        {
          value: contact.phone.trim(),
          type: 'mobile',
        },
      ],
    };

    if (contact.designation?.trim() || contact.department?.trim()) {
      body.organizations = [
        {
          title: contact.designation?.trim() || '',
          department: contact.department?.trim() || '',
        },
      ];
    }

    const noteText = contact.notes?.trim()
      ? `${contact.notes.trim()} (শ্রমিক সাথী অ্যাপ থেকে সংরক্ষিত)`
      : 'শ্রমিক সাথী অ্যাপ থেকে সংরক্ষিত কন্ট্যাক্ট';

    body.biographies = [
      {
        value: noteText,
        contentType: 'TEXT_PLAIN',
      },
    ];

    const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        error: `HTTP ${res.status}: ${res.statusText} ${errText}`,
      };
    }

    const created = await res.json();
    return {
      success: true,
      resourceName: created.resourceName,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to upload contact to Google',
    };
  }
}

/**
 * Backs up and syncs an array of WorkerContact items to the user's Google Account.
 * Avoids duplicate uploads if a contact already has a googleResourceName or matching phone in Google.
 */
export async function backupAllContactsToGoogle(
  accessToken: string,
  contacts: WorkerContact[],
  onProgress?: (completed: number, total: number, currentName: string) => void
): Promise<{
  uploaded: number;
  skipped: number;
  failed: number;
  syncedIds: string[];
}> {
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const syncedIds: string[] = [];

  // First fetch existing contacts to prevent duplicates
  let existingPhones = new Set<string>();
  try {
    const existing = await fetchGoogleContacts(accessToken);
    existingPhones = new Set(
      existing.map((c) => c.phone.replace(/[^\d]/g, '').slice(-10)).filter(Boolean)
    );
  } catch (err) {
    console.warn('Could not check existing contacts, proceeding with caution', err);
  }

  const total = contacts.length;
  for (let i = 0; i < total; i++) {
    const c = contacts[i];
    const cleanDigits = c.phone.replace(/[^\d]/g, '').slice(-10);

    if (onProgress) {
      onProgress(i + 1, total, c.fullName);
    }

    // Skip if already confirmed synced or already present on Google
    if (c.isSyncedToGoogle || (cleanDigits && existingPhones.has(cleanDigits))) {
      skipped++;
      syncedIds.push(c.id);
      continue;
    }

    const result = await createContactOnGoogle(accessToken, {
      fullName: c.fullName,
      phone: c.phone,
      designation: c.designation === 'ফ্রম গুগল' || c.designation === 'From Google' ? undefined : c.designation,
      department: c.department,
      notes: c.notes,
    });

    if (result.success) {
      uploaded++;
      syncedIds.push(c.id);
      if (cleanDigits) existingPhones.add(cleanDigits);
    } else {
      failed++;
    }

    // Small delay to be polite to Google People API rate limits
    if (i < total - 1) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return { uploaded, skipped, failed, syncedIds };
}
