import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Edit2,
  Heart,
  History,
  Layers,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  Pin,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  getGoogleContactsAccessToken,
  fetchGoogleContacts,
  createContactOnGoogle,
  backupAllContactsToGoogle,
} from '../utils/googleContactsService';
import type {
  GarmentWorkplace,
  WorkerContact,
  WorkerContactCategory,
} from '../types';
import {
  formatPhoneForCall,
  formatWhatsAppUrl,
  isValidBangladeshiPhone,
  toBengaliDigits,
  WORKER_CONTACT_CATEGORIES,
} from '../utils/calculations';
import {
  normalizeBDPhoneNumber,
  toEnglishDisplayPhone,
  deduplicateContactsList,
  smartSearchContacts,
  mergeTwoContacts,
} from '../utils/contactDeduplication';
import { formatDateReadable } from '../utils/i18n';

type ActiveTab = 'workplace' | 'contacts' | 'emergency';

export const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const GarmentContactBookView: React.FC = () => {
  const {
    workplaces,
    contacts,
    saveWorkplace,
    deleteWorkplace,
    saveContact,
    deleteContact,
    toggleFavoriteContact,
    profile,
    updateProfile,
    lang,
  } = useData();

  const [activeTab, setActiveTab] = useState<ActiveTab>('contacts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusNotice, setStatusNotice] = useState('');
  const [statusError, setStatusError] = useState('');

  // Workplace Modal State
  const [workplaceModalOpen, setWorkplaceModalOpen] = useState(false);
  const [editingWorkplaceId, setEditingWorkplaceId] = useState<string | null>(null);
  const [wpFactoryName, setWpFactoryName] = useState('');
  const [wpFactoryAddress, setWpFactoryAddress] = useState('');
  const [wpFactoryArea, setWpFactoryArea] = useState('');
  const [wpDepartment, setWpDepartment] = useState('');
  const [wpFloorNumber, setWpFloorNumber] = useState('');
  const [wpLineNumber, setWpLineNumber] = useState('');
  const [wpDesignation, setWpDesignation] = useState('');
  const [wpSupervisorName, setWpSupervisorName] = useState('');
  const [wpJoiningDate, setWpJoiningDate] = useState('');
  const [wpFactoryPhone, setWpFactoryPhone] = useState('');
  const [wpNotes, setWpNotes] = useState('');
  const [wpIsCurrent, setWpIsCurrent] = useState(true);

  // Contact Modal State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [ctFullName, setCtFullName] = useState('');
  const [ctPhone, setCtPhone] = useState('');
  const [ctDesignation, setCtDesignation] = useState('');
  const [ctCategory, setCtCategory] = useState<WorkerContactCategory>('supervisor');
  const [ctCustomCategory, setCtCustomCategory] = useState('');
  const [ctDepartment, setCtDepartment] = useState('');
  const [ctLineNumber, setCtLineNumber] = useState('');
  const [ctNotes, setCtNotes] = useState('');
  const [ctIsPinned, setCtIsPinned] = useState(false);
  const [ctIsFavorite, setCtIsFavorite] = useState(false);
  const [ctIsEmergency, setCtIsEmergency] = useState(false);

  // Copy phone state & Duplicate merge state
  const [copiedPhoneContactId, setCopiedPhoneContactId] = useState<string | null>(null);
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);

  // Google Contacts Sync & Backup state
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isBackingUpGoogle, setIsBackingUpGoogle] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
  } | null>(null);
  const [backupConfirmOpen, setBackupConfirmOpen] = useState(false);
  const [saveToGoogleAccount, setSaveToGoogleAccount] = useState(false);
  const [uploadingSingleContactId, setUploadingSingleContactId] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'workplace' | 'contact';
    id: string;
    title: string;
  } | null>(null);

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(''), 3500);
  };

  const showError = (msg: string) => {
    setStatusError(msg);
    setTimeout(() => setStatusError(''), 4000);
  };

  /**
   * One-tap phone number copy with visual confirmation.
   * Copies phone number in clean English digits.
   */
  const handleCopyPhone = async (phone: string, contactId: string) => {
    const engPhone = toEnglishDisplayPhone(phone);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(engPhone);
      } else {
        const temp = document.createElement('textarea');
        temp.value = engPhone;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setCopiedPhoneContactId(contactId);
      setTimeout(() => {
        setCopiedPhoneContactId((prev) => (prev === contactId ? null : prev));
      }, 2000);
    } catch {
      showError(lang === 'bn' ? 'নম্বর কপি করা যায়নি' : 'Failed to copy number');
    }
  };

  /**
   * Imports contacts from Google People API.
   * Automatically deduplicates incoming contacts with existing records.
   * Numbers are stored in standard English digits.
   */
  const handleSyncGoogleContacts = async () => {
    try {
      setIsSyncingGoogle(true);
      const accessToken = await getGoogleContactsAccessToken();

      if (!accessToken) {
        showError(
          lang === 'bn'
            ? 'গুগল কন্ট্যাক্টস এক্সেস অনুমতি পাওয়া যায়নি'
            : 'Google Contacts access permission was not granted'
        );
        setIsSyncingGoogle(false);
        return;
      }

      const connections = await fetchGoogleContacts(accessToken);

      let importedCount = 0;
      let mergedCount = 0;

      for (const person of connections) {
        const name = person.fullName;
        const phone = person.phone;

        if (name && phone) {
          const normPhone = normalizeBDPhoneNumber(phone);
          const englishPhone = toEnglishDisplayPhone(phone);
          const existing = contacts.find(
            (c) =>
              normalizeBDPhoneNumber(c.phone) === normPhone ||
              c.fullName.toLowerCase() === name.toLowerCase()
          );

          // Designation rule:
          // If Google Contact already has designation, keep that exact designation.
          // If no designation is provided in Google Contacts, default to "ফ্রম গুগল" / "From Google".
          const resolvedDesignation =
            person.designation && person.designation.trim().length > 0
              ? person.designation.trim()
              : (lang === 'bn' ? 'ফ্রম গুগল' : 'From Google');

          if (!existing) {
            await saveContact({
              fullName: name,
              phone: englishPhone,
              designation: resolvedDesignation,
              category: 'google',
              department: person.department || '',
              lineNumber: '',
              notes:
                person.notes ||
                (lang === 'bn' ? 'গুগল কন্ট্যাক্টস থেকে সিঙ্ক করা হয়েছে' : 'Synced from Google Contacts'),
              isFavorite: false,
              isEmergency: false,
              source: 'google',
              googleResourceName: person.resourceName,
              isSyncedToGoogle: true,
            });
            importedCount++;
          } else {
            // Auto-merge with existing record to avoid duplicate
            const merged = mergeTwoContacts(existing, {
              id: existing.id,
              userId: existing.userId,
              fullName: name,
              phone: englishPhone,
              designation: resolvedDesignation,
              category: existing.category === 'google' ? 'google' : existing.category,
              department: person.department || existing.department || '',
              lineNumber: existing.lineNumber || '',
              notes: existing.notes || person.notes,
              isFavorite: existing.isFavorite,
              isEmergency: existing.isEmergency,
              source: 'google',
              googleResourceName: person.resourceName || existing.googleResourceName,
              isSyncedToGoogle: true,
            });

            await saveContact(
              {
                fullName: merged.fullName,
                phone: toEnglishDisplayPhone(merged.phone),
                designation: merged.designation,
                category: merged.category,
                customCategory: merged.customCategory,
                department: merged.department,
                lineNumber: merged.lineNumber,
                notes: merged.notes,
                isFavorite: merged.isFavorite,
                isEmergency: merged.isEmergency,
                source: 'google',
                googleResourceName: merged.googleResourceName,
                isSyncedToGoogle: true,
              },
              existing.id
            );
            mergedCount++;
          }
        }
      }

      showNotice(
        lang === 'bn'
          ? `গুগল কন্ট্যাক্টস থেকে ${toBengaliDigits(importedCount)} টি নতুন কন্ট্যাক্ট যোগ ও ${toBengaliDigits(mergedCount)} টি মার্জ করা হয়েছে!`
          : `Synced ${importedCount} new contacts and merged ${mergedCount} existing contacts from Google!`
      );
    } catch (err: any) {
      console.error('Google Contacts Sync Error:', err);
      showError(
        lang === 'bn'
          ? 'গুগল কন্ট্যাক্ট সিঙ্ক করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।'
          : 'Failed to sync Google Contacts. Please try again.'
      );
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  /**
   * Backs up and uploads all saved contacts in the app to the user's Google Account.
   */
  const handleBackupAllToGoogle = async () => {
    setBackupConfirmOpen(false);
    if (contacts.length === 0) {
      showError(lang === 'bn' ? 'ব্যাকআপ করার মতো কোনো কন্ট্যাক্ট নেই।' : 'No contacts to backup.');
      return;
    }

    try {
      setIsBackingUpGoogle(true);
      setBackupProgress({ current: 0, total: contacts.length, currentName: '' });

      const accessToken = await getGoogleContactsAccessToken();
      if (!accessToken) {
        showError(
          lang === 'bn'
            ? 'গুগল এক্সেস অনুমতি পাওয়া যায়নি'
            : 'Google Access permission not granted'
        );
        setIsBackingUpGoogle(false);
        setBackupProgress(null);
        return;
      }

      const result = await backupAllContactsToGoogle(
        accessToken,
        contacts,
        (current, total, currentName) => {
          setBackupProgress({ current, total, currentName });
        }
      );

      // Update contacts in local state & Firestore to mark isSyncedToGoogle = true
      for (const id of result.syncedIds) {
        const c = contacts.find((item) => item.id === id);
        if (c && !c.isSyncedToGoogle) {
          await saveContact(
            {
              fullName: c.fullName,
              phone: c.phone,
              designation: c.designation,
              category: c.category,
              department: c.department,
              lineNumber: c.lineNumber,
              notes: c.notes,
              isFavorite: c.isFavorite,
              isEmergency: c.isEmergency,
              source: c.source || 'google',
              googleResourceName: c.googleResourceName,
              isSyncedToGoogle: true,
            },
            c.id
          );
        }
      }

      showNotice(
        lang === 'bn'
          ? `গুগল অ্যাকাউন্টে ${toBengaliDigits(result.uploaded)} টি কন্ট্যাক্ট সফলভাবে ব্যাকআপ করা হয়েছে${
              result.skipped > 0
                ? ` (${toBengaliDigits(result.skipped)} টি পূর্বে থেকেই গুগলে ছিল)`
                : ''
            }!`
          : `Successfully backed up ${result.uploaded} contacts to Google${
              result.skipped > 0 ? ` (${result.skipped} already in Google Contacts)` : ''
            }!`
      );
    } catch (err: any) {
      console.error('Google Backup Error:', err);
      showError(
        lang === 'bn'
          ? 'গুগলে ব্যাকআপ সম্পন্ন করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।'
          : 'Failed to backup contacts to Google. Please try again.'
      );
    } finally {
      setIsBackingUpGoogle(false);
      setBackupProgress(null);
    }
  };

  /**
   * Uploads a single contact directly to Google Contacts.
   */
  const handleUploadSingleContactToGoogle = async (contact: WorkerContact) => {
    try {
      setUploadingSingleContactId(contact.id);
      const accessToken = await getGoogleContactsAccessToken();
      if (!accessToken) {
        showError(
          lang === 'bn'
            ? 'গুগল কন্ট্যাক্টস এক্সেস অনুমতি পাওয়া যায়নি'
            : 'Google Access permission not granted'
        );
        setUploadingSingleContactId(null);
        return;
      }

      const res = await createContactOnGoogle(accessToken, {
        fullName: contact.fullName,
        phone: contact.phone,
        designation:
          contact.designation === 'ফ্রম গুগল' || contact.designation === 'From Google'
            ? undefined
            : contact.designation,
        department: contact.department,
        notes: contact.notes,
      });

      if (res.success) {
        await saveContact(
          {
            fullName: contact.fullName,
            phone: contact.phone,
            designation: contact.designation,
            category: contact.category,
            department: contact.department,
            lineNumber: contact.lineNumber,
            notes: contact.notes,
            isFavorite: contact.isFavorite,
            isEmergency: contact.isEmergency,
            source: contact.source || 'google',
            googleResourceName: res.resourceName,
            isSyncedToGoogle: true,
          },
          contact.id
        );

        showNotice(
          lang === 'bn'
            ? `“${contact.fullName}” সফলভাবে আপনার গুগল অ্যাকাউন্টে সেভ করা হয়েছে!`
            : `Saved "${contact.fullName}" to your Google Contacts!`
        );
      } else {
        showError(
          lang === 'bn'
            ? `গুগলে সেভ ব্যর্থ: ${res.error || 'পুনরায় চেষ্টা করুন'}`
            : `Failed to save to Google: ${res.error || 'Please try again'}`
        );
      }
    } catch (err) {
      console.error('Error saving single contact to Google:', err);
      showError(lang === 'bn' ? 'গুগলে সেভ করা ব্যর্থ হয়েছে' : 'Failed to save to Google');
    } finally {
      setUploadingSingleContactId(null);
    }
  };

  // Find current workplace (or fallback to profile if workplaces array is empty)
  const currentWorkplace = useMemo(() => {
    const found = workplaces.find((w) => w.isCurrent);
    if (found) return found;
    if (workplaces.length > 0) return workplaces[0];
    return null;
  }, [workplaces]);

  const pastWorkplaces = useMemo(() => {
    return workplaces.filter((w) => currentWorkplace ? w.id !== currentWorkplace.id : false);
  }, [workplaces, currentWorkplace]);

  // Deduplication stats & detection on all contacts
  const duplicateStats = useMemo(() => {
    return deduplicateContactsList(contacts);
  }, [contacts]);

  // Filtered Contacts with Smart Search (bidirectional digit & multi-field matching)
  const filteredContacts = useMemo(() => {
    return smartSearchContacts(contacts, searchQuery, selectedCategory);
  }, [contacts, selectedCategory, searchQuery]);

  // Emergency Contacts
  const emergencyContactsList = useMemo(() => {
    return contacts.filter((c) => c.isEmergency || c.category === 'emergency');
  }, [contacts]);

  /**
   * Automatically merges all detected duplicate contacts into unified records,
   * cleaning redundant duplicate IDs from data storage.
   */
  const handleAutoMergeDuplicates = async () => {
    if (duplicateStats.duplicateCount === 0) return;
    try {
      setIsMergingDuplicates(true);
      // Save all updated merged contacts
      for (const contact of duplicateStats.mergedContacts) {
        await saveContact(
          {
            fullName: contact.fullName,
            phone: toEnglishDisplayPhone(contact.phone),
            designation: contact.designation,
            category: contact.category,
            customCategory: contact.customCategory,
            department: contact.department,
            lineNumber: contact.lineNumber,
            notes: contact.notes,
            isFavorite: contact.isFavorite,
            isEmergency: contact.isEmergency,
            source: contact.source,
            googleResourceName: contact.googleResourceName,
            isSyncedToGoogle: contact.isSyncedToGoogle,
          },
          contact.id
        );
      }
      // Remove duplicate redundant contact IDs
      for (const dupId of duplicateStats.duplicateIdsToRemove) {
        await deleteContact(dupId);
      }
      showNotice(
        lang === 'bn'
          ? `সফলভাবে ${toBengaliDigits(duplicateStats.duplicateCount)} টি ডুপ্লিকেট কন্ট্যাক্ট মার্জ করা হয়েছে!`
          : `Successfully merged ${duplicateStats.duplicateCount} duplicate contacts!`
      );
    } catch (err) {
      console.error('Auto merge error:', err);
      showError(lang === 'bn' ? 'ডুপ্লিকেট মার্জ ব্যর্থ হয়েছে' : 'Failed to merge duplicates');
    } finally {
      setIsMergingDuplicates(false);
    }
  };

  // Workplace Handlers
  const handleOpenAddWorkplace = () => {
    setEditingWorkplaceId(null);
    setWpFactoryName('');
    setWpFactoryAddress('');
    setWpFactoryArea('');
    setWpDepartment('');
    setWpFloorNumber('');
    setWpLineNumber('');
    setWpDesignation(profile.designation || 'অপারেটর');
    setWpSupervisorName('');
    setWpJoiningDate(new Date().toISOString().slice(0, 10));
    setWpFactoryPhone('');
    setWpNotes('');
    setWpIsCurrent(workplaces.length === 0);
    setWorkplaceModalOpen(true);
  };

  const handleOpenEditWorkplace = (wp: GarmentWorkplace) => {
    setEditingWorkplaceId(wp.id);
    setWpFactoryName(wp.factoryName);
    setWpFactoryAddress(wp.factoryAddress || '');
    setWpFactoryArea(wp.factoryArea || '');
    setWpDepartment(wp.department || '');
    setWpFloorNumber(wp.floorNumber || '');
    setWpLineNumber(wp.lineNumber || '');
    setWpDesignation(wp.designation || '');
    setWpSupervisorName(wp.supervisorName || '');
    setWpJoiningDate(wp.joiningDate || '');
    setWpFactoryPhone(wp.factoryPhone || '');
    setWpNotes(wp.notes || '');
    setWpIsCurrent(wp.isCurrent);
    setWorkplaceModalOpen(true);
  };

  const handleSaveWorkplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wpFactoryName.trim()) {
      showError(lang === 'bn' ? 'কারখানার নাম প্রদান করুন' : 'Factory name is required');
      return;
    }

    try {
      await saveWorkplace(
        {
          factoryName: wpFactoryName.trim(),
          factoryAddress: wpFactoryAddress.trim(),
          factoryArea: wpFactoryArea.trim(),
          department: wpDepartment.trim(),
          floorNumber: wpFloorNumber.trim(),
          lineNumber: wpLineNumber.trim(),
          designation: wpDesignation.trim(),
          supervisorName: wpSupervisorName.trim(),
          joiningDate: wpJoiningDate.trim(),
          factoryPhone: wpFactoryPhone.trim(),
          notes: wpNotes.trim(),
          isCurrent: wpIsCurrent,
        },
        editingWorkplaceId || undefined
      );

      // If marked as current, also sync profile factory name and designation
      if (wpIsCurrent) {
        await updateProfile({
          factoryName: wpFactoryName.trim(),
          department: wpDepartment.trim() || profile.department,
          designation: wpDesignation.trim() || profile.designation,
        });
      }

      setWorkplaceModalOpen(false);
      showNotice(
        lang === 'bn'
          ? 'কারখানা ও কর্মস্থল তথ্য সফলভাবে সংরক্ষিত হয়েছে'
          : 'Workplace details saved successfully'
      );
    } catch {
      showError(lang === 'bn' ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save workplace');
    }
  };

  const handleSetAsCurrent = async (wp: GarmentWorkplace) => {
    try {
      await saveWorkplace(
        {
          factoryName: wp.factoryName,
          factoryAddress: wp.factoryAddress,
          factoryArea: wp.factoryArea,
          department: wp.department,
          floorNumber: wp.floorNumber,
          lineNumber: wp.lineNumber,
          designation: wp.designation,
          supervisorName: wp.supervisorName,
          joiningDate: wp.joiningDate,
          factoryPhone: wp.factoryPhone,
          notes: wp.notes,
          isCurrent: true,
        },
        wp.id
      );

      await updateProfile({
        factoryName: wp.factoryName,
        department: wp.department || profile.department,
        designation: wp.designation || profile.designation,
      });

      showNotice(
        lang === 'bn'
          ? `“${wp.factoryName}” আপনার বর্তমান কর্মস্থল হিসেবে সেট করা হয়েছে`
          : `Set "${wp.factoryName}" as current workplace`
      );
    } catch {
      showError(lang === 'bn' ? 'পরিবর্তন ব্যর্থ হয়েছে' : 'Failed to update current workplace');
    }
  };

  // Contact Handlers
  const handleOpenAddContact = () => {
    setEditingContactId(null);
    setCtFullName('');
    setCtPhone('');
    setCtDesignation('');
    setCtCategory('supervisor');
    setCtCustomCategory('');
    setCtDepartment(currentWorkplace?.department || '');
    setCtLineNumber(currentWorkplace?.lineNumber || '');
    setCtNotes('');
    setCtIsPinned(false);
    setCtIsFavorite(false);
    setCtIsEmergency(false);
    setSaveToGoogleAccount(true); // Default to saving to Google as requested by user
    setContactModalOpen(true);
  };

  const handleOpenEditContact = (c: WorkerContact) => {
    setEditingContactId(c.id);
    setCtFullName(c.fullName);
    setCtPhone(toEnglishDisplayPhone(c.phone));
    setCtDesignation(c.designation || '');
    setCtCategory((c.category as WorkerContactCategory) || 'supervisor');
    setCtCustomCategory(c.customCategory || (c.category === 'other' ? c.designation || '' : ''));
    setCtDepartment(c.department || '');
    setCtLineNumber(c.lineNumber || '');
    setCtNotes(c.notes || '');
    setCtIsPinned(Boolean(c.isPinned));
    setCtIsFavorite(c.isFavorite);
    setCtIsEmergency(c.isEmergency);
    setSaveToGoogleAccount(Boolean(c.isSyncedToGoogle));
    setContactModalOpen(true);
  };

  const handleTogglePinContact = async (contact: WorkerContact) => {
    try {
      const nextPinned = !contact.isPinned;
      await saveContact(
        {
          fullName: contact.fullName,
          phone: contact.phone,
          designation: contact.designation,
          category: contact.category,
          customCategory: contact.customCategory,
          department: contact.department,
          lineNumber: contact.lineNumber,
          notes: contact.notes,
          isPinned: nextPinned,
          isFavorite: contact.isFavorite,
          isEmergency: contact.isEmergency,
          source: contact.source,
          googleResourceName: contact.googleResourceName,
          isSyncedToGoogle: contact.isSyncedToGoogle,
        },
        contact.id
      );
      showNotice(
        lang === 'bn'
          ? nextPinned
            ? 'কন্ট্যাক্টটি উপরে পিন করা হয়েছে'
            : 'কন্ট্যাক্টটি আনপিন করা হয়েছে'
          : nextPinned
          ? 'Contact pinned to top'
          : 'Contact unpinned'
      );
    } catch {
      showError(lang === 'bn' ? 'পিন আপডেট করা সম্ভব হয়নি' : 'Failed to update pin');
    }
  };

  const handleSaveContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctFullName.trim()) {
      showError(lang === 'bn' ? 'কন্ট্যাক্টের নাম প্রদান করুন' : 'Contact name is required');
      return;
    }
    if (!ctPhone.trim()) {
      showError(lang === 'bn' ? 'ফোন নম্বর প্রদান করুন' : 'Phone number is required');
      return;
    }

    if (!isValidBangladeshiPhone(ctPhone.trim())) {
      showError(
        lang === 'bn'
          ? 'সঠিক বাংলাদেশী মোবাইল নম্বর (যেমন: 017XXXXXXXX) বা হটলাইন প্রদান করুন'
          : 'Please enter a valid Bangladeshi phone number (e.g., 017XXXXXXXX) or hotline'
      );
      return;
    }

    try {
      const englishPhone = toEnglishDisplayPhone(ctPhone.trim());
      const normalizedPhone = normalizeBDPhoneNumber(englishPhone);

      // Auto-merge duplicate: if creating a new contact and this number already exists, auto-merge with existing
      let targetContactId = editingContactId;
      let autoMerged = false;

      if (!targetContactId) {
        const existingSameNumber = contacts.find(
          (c) => normalizeBDPhoneNumber(c.phone) === normalizedPhone
        );
        if (existingSameNumber) {
          targetContactId = existingSameNumber.id;
          autoMerged = true;
        }
      }

      let isSyncedToGoogle = false;
      let googleResourceName: string | undefined = undefined;

      // Existing contact info if editing or merging
      const existingContact = targetContactId
        ? contacts.find((c) => c.id === targetContactId)
        : null;

      if (existingContact) {
        isSyncedToGoogle = Boolean(existingContact.isSyncedToGoogle);
        googleResourceName = existingContact.googleResourceName;
      }

      // If user chose to sync/save to Google Account directly
      if (saveToGoogleAccount && (!isSyncedToGoogle || !targetContactId)) {
        try {
          const accessToken = await getGoogleContactsAccessToken();
          if (accessToken) {
            const googleRes = await createContactOnGoogle(accessToken, {
              fullName: ctFullName.trim(),
              phone: englishPhone,
              designation:
                ctDesignation.trim() === 'ফ্রম গুগল' || ctDesignation.trim() === 'From Google'
                  ? undefined
                  : ctDesignation.trim() || undefined,
              department: ctDepartment.trim() || undefined,
              notes: ctNotes.trim() || undefined,
            });
            if (googleRes.success) {
              isSyncedToGoogle = true;
              googleResourceName = googleRes.resourceName;
            }
          }
        } catch (gErr) {
          console.warn('Could not save to Google directly, proceeding with local save', gErr);
        }
      }

      const finalCustomCategory =
        ctCategory === 'other' && ctCustomCategory.trim()
          ? ctCustomCategory.trim()
          : (existingContact?.customCategory || undefined);

      await saveContact(
        {
          fullName: ctFullName.trim(),
          phone: englishPhone,
          designation: ctDesignation.trim() || undefined,
          category: ctCategory,
          customCategory: finalCustomCategory,
          department: ctDepartment.trim() || undefined,
          lineNumber: ctLineNumber.trim() || undefined,
          notes: ctNotes.trim() || undefined,
          isPinned: ctIsPinned,
          isFavorite: ctIsFavorite,
          isEmergency: ctIsEmergency,
          source: isSyncedToGoogle ? 'google' : (existingContact?.source || 'manual'),
          googleResourceName,
          isSyncedToGoogle,
        },
        targetContactId || undefined
      );

      setContactModalOpen(false);
      showNotice(
        lang === 'bn'
          ? autoMerged
            ? 'একই নম্বরের পূর্ববর্তী কন্ট্যাক্টের সাথে সফলভাবে মার্জ ও সংরক্ষিত হয়েছে!'
            : isSyncedToGoogle
            ? 'কন্ট্যাক্ট সফলভাবে অ্যাপ এবং গুগল অ্যাকাউন্টে সংরক্ষিত হয়েছে'
            : 'কন্ট্যাক্ট সফলভাবে সংরক্ষিত হয়েছে'
          : autoMerged
          ? 'Contact merged with existing entry and saved!'
          : isSyncedToGoogle
          ? 'Contact saved to app and your Google Account successfully'
          : 'Contact saved successfully'
      );
    } catch {
      showError(lang === 'bn' ? 'কন্ট্যাক্ট সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save contact');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'workplace') {
        await deleteWorkplace(deleteConfirm.id);
        showNotice(
          lang === 'bn'
            ? 'কর্মস্থল তথ্য মুছে ফেলা হয়েছে (পুনরুদ্ধার সম্ভব)'
            : 'Workplace removed (can be restored from history)'
        );
      } else {
        await deleteContact(deleteConfirm.id);
        showNotice(
          lang === 'bn'
            ? 'কন্ট্যাক্ট মুছে ফেলা হয়েছে (পুনরুদ্ধার সম্ভব)'
            : 'Contact removed (can be restored from history)'
        );
      }
    } catch {
      showError(lang === 'bn' ? 'মুছে ফেলা ব্যর্থ হয়েছে' : 'Failed to delete record');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const getCategoryMeta = (cat: WorkerContactCategory | string, customCat?: string) => {
    if (customCat && customCat.trim()) {
      return {
        id: cat,
        labelBn: customCat.trim(),
        labelEn: customCat.trim(),
        color: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
        iconName: 'User',
      };
    }
    const item = WORKER_CONTACT_CATEGORIES.find((c) => c.id === cat);
    return (
      item || {
        id: cat,
        labelBn: cat === 'other' ? 'কাস্টম সম্পর্ক' : cat,
        labelEn: cat === 'other' ? 'Custom Role' : cat,
        color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        iconName: 'Phone',
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-900 text-white shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300" />
            </div>
            <h2 className="text-base sm:text-xl font-bold tracking-tight truncate">
              {lang === 'bn' ? 'কন্টাক্ট বুক' : 'Contact Book'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'workplace' && (
              <button
                type="button"
                data-testid="add-workplace-btn"
                onClick={handleOpenAddWorkplace}
                className="min-h-[36px] sm:min-h-[40px] px-3 py-1.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs sm:text-sm font-bold shadow-xs inline-flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{lang === 'bn' ? 'কারখানা যোগ' : 'Add Factory'}</span>
              </button>
            )}
            {activeTab !== 'workplace' && (
              <button
                type="button"
                data-testid="add-contact-btn"
                onClick={handleOpenAddContact}
                className="min-h-[36px] sm:min-h-[40px] px-3 py-1.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs sm:text-sm font-bold shadow-xs inline-flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>{lang === 'bn' ? 'নতুন কন্টাক্ট' : 'Add Contact'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Main Tab Selectors — Compact Single-Line Grid on Mobile with Zero Scrollbar */}
        <div className="mt-3 pt-2.5 border-t border-white/15 grid grid-cols-3 gap-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            data-testid="tab-contacts"
            onClick={() => setActiveTab('contacts')}
            className={`min-h-[34px] px-1.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center justify-center gap-1 ${
              activeTab === 'contacts'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-white/85 hover:bg-white/10'
            }`}
          >
            <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'কন্টাক্ট বুক' : 'Contact Book'}</span>
            <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-900/30 font-semibold">
              {toBengaliDigits(contacts.length)}
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-workplace"
            onClick={() => setActiveTab('workplace')}
            className={`min-h-[34px] px-1.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center justify-center gap-1 ${
              activeTab === 'workplace'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-white/85 hover:bg-white/10'
            }`}
          >
            <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'আমার গার্মেন্টস' : 'My Garment'}</span>
          </button>

          <button
            type="button"
            data-testid="tab-emergency"
            onClick={() => setActiveTab('emergency')}
            className={`min-h-[34px] px-1.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center justify-center gap-1 ${
              activeTab === 'emergency'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-rose-200 hover:bg-white/10'
            }`}
          >
            <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'জরুরি ফোন নাম্বার' : 'Emergency'}</span>
            <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-semibold">
              {toBengaliDigits(emergencyContactsList.length + 3)}
            </span>
          </button>
        </div>
      </div>

      {/* Notices & Errors */}
      {statusNotice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusNotice}</span>
        </div>
      )}

      {statusError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-300 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{statusError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: WORKPLACE (আমার গার্মেন্টস) */}
      {/* ========================================================================= */}
      {activeTab === 'workplace' && (
        <div className="space-y-6">
          {/* Active Workplace Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full pointer-events-none" />

            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                      {lang === 'bn' ? 'বর্তমান কারখানা (Active)' : 'Current Workplace'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {currentWorkplace?.factoryName || profile.factoryName || 'কারখানার নাম সংযুক্ত নেই'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentWorkplace ? (
                  <button
                    type="button"
                    data-testid="edit-current-workplace-btn"
                    onClick={() => handleOpenEditWorkplace(currentWorkplace)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'তথ্য পরিবর্তন / সম্পাদন' : 'Edit Factory'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenAddWorkplace}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'কর্মস্থল তথ্য তৈরি করুন' : 'Add Workplace'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Workplace Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                  {lang === 'bn' ? 'এলাকা ও ঠিকানা' : 'Area & Address'}
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    {currentWorkplace?.factoryArea || currentWorkplace?.factoryAddress
                      ? `${currentWorkplace.factoryArea ? currentWorkplace.factoryArea + ' — ' : ''}${currentWorkplace.factoryAddress || ''}`
                      : profile.factoryBranch || 'ঠিকানা দেওয়া হয়নি'}
                  </span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                  {lang === 'bn' ? 'সেকশন ও লাইন' : 'Section & Line'}
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {currentWorkplace?.department || profile.department || 'সেকশন নির্ধারণ করা নেই'}
                  {currentWorkplace?.lineNumber && ` • ${currentWorkplace.lineNumber}`}
                  {currentWorkplace?.floorNumber && ` (${currentWorkplace.floorNumber})`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                  {lang === 'bn' ? 'আপনার পদবী (Designation)' : 'Designation'}
                </span>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {currentWorkplace?.designation || profile.designation || 'অপারেটর'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                  {lang === 'bn' ? 'সুপারভাইজার' : 'Supervisor'}
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{currentWorkplace?.supervisorName || 'সুপারভাইজার নাম যোগ করা নেই'}</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                  {lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}
                </span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    {currentWorkplace?.joiningDate
                      ? formatDateReadable(currentWorkplace.joiningDate, lang)
                      : profile.joiningDate
                      ? formatDateReadable(profile.joiningDate, lang)
                      : 'তথ্য নেই'}
                  </span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
                  {lang === 'bn' ? 'ফ্যাক্টরি ফোন / গেট নম্বর' : 'Factory Phone'}
                </span>
                {currentWorkplace?.factoryPhone ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono tracking-wide">
                      {toEnglishDisplayPhone(currentWorkplace.factoryPhone)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(currentWorkplace.factoryPhone!, 'wp-phone')}
                        className={`min-h-[30px] px-2 py-0.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                          copiedPhoneContactId === 'wp-phone'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                        }`}
                        title="Copy phone"
                      >
                        {copiedPhoneContactId === 'wp-phone' ? (
                          <>
                            <Check className="w-3 h-3 text-white" />
                            <span className="text-[10px]">{lang === 'bn' ? 'কপি!' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                      <a
                        href={formatPhoneForCall(currentWorkplace.factoryPhone)}
                        className="min-h-[30px] px-2.5 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>{lang === 'bn' ? 'কল' : 'Call'}</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    {lang === 'bn' ? 'ফোন নম্বর দেওয়া নেই' : 'No phone provided'}
                  </p>
                )}
              </div>
            </div>

            {currentWorkplace?.notes && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold">{lang === 'bn' ? 'বিশেষ নোট: ' : 'Note: '}</span>
                <span>{currentWorkplace.notes}</span>
              </div>
            )}
          </div>

          {/* Past Workplace History Section */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'পূর্ববর্তী কর্মস্থলের ইতিহাস' : 'Previous Workplace History'}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  {toBengaliDigits(pastWorkplaces.length)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenAddWorkplace}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'আগের কারখানা যোগ' : 'Add Past Factory'}</span>
              </button>
            </div>

            {pastWorkplaces.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p>
                  {lang === 'bn'
                    ? 'কোনো পূর্ববর্তী কারখানার রেকর্ড সংরক্ষিত নেই। আপনি চাইলে আগের চাকরির অভিজ্ঞতা এখানে যোগ করে রাখতে পারেন।'
                    : 'No previous factory records found. You can add your past workplace history here.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {pastWorkplaces.map((wp) => (
                  <div
                    key={wp.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {wp.factoryName}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 shrink-0">
                          {lang === 'bn' ? 'পূর্ববর্তী' : 'Past'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {wp.department && `${wp.department} • `}
                        {wp.designation && <span className="font-semibold text-slate-700 dark:text-slate-300">{wp.designation}</span>}
                      </p>
                      {wp.factoryArea && (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{wp.factoryArea}</span>
                        </p>
                      )}
                      {wp.joiningDate && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {lang === 'bn' ? `যোগদান: ${formatDateReadable(wp.joiningDate, 'bn')}` : `Joined: ${wp.joiningDate}`}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleSetAsCurrent(wp)}
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'বর্তমান কর্মস্থল বানান' : 'Set as Current'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditWorkplace(wp)}
                          className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'workplace',
                              id: wp.id,
                              title: wp.factoryName,
                            })
                          }
                          className="w-8 h-8 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CONTACT BOOK (কন্ট্যাক্ট বুক) */}
      {/* ========================================================================= */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {/* Action Bar: Add Contact, Import from Google & Backup to Google */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{lang === 'bn' ? 'আমার কন্ট্যাক্ট লিস্ট' : 'My Contacts List'}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  {toBengaliDigits(contacts.length)}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'bn'
                  ? 'ব্যক্তিগত ফোনবুক এবং গুগলের সাথে ২-মুখী ব্যাকআপ ও সিঙ্ক'
                  : 'Private phonebook with 2-way Google Contacts backup & sync'}
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-2">
              {/* Import from Google Contacts */}
              <button
                type="button"
                data-testid="sync-google-contacts-btn"
                onClick={handleSyncGoogleContacts}
                disabled={isSyncingGoogle || isBackingUpGoogle}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-2 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                title={lang === 'bn' ? 'গুগল কন্ট্যাক্টস থেকে আমদানি করুন' : 'Import from Google Contacts'}
              >
                <GoogleIcon className="w-4 h-4 shrink-0" />
                <span>
                  {isSyncingGoogle
                    ? (lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...')
                    : (lang === 'bn' ? 'গুগল থেকে আনুন' : 'Import from Google')}
                </span>
              </button>

              {/* Backup All to Google Contacts */}
              <button
                type="button"
                data-testid="backup-google-contacts-btn"
                onClick={() => setBackupConfirmOpen(true)}
                disabled={isSyncingGoogle || isBackingUpGoogle || contacts.length === 0}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold inline-flex items-center gap-2 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                title={lang === 'bn' ? 'অ্যাপের সকল কন্ট্যাক্ট গুগল অ্যাকাউন্টে ব্যাকআপ করুন' : 'Backup all contacts to Google'}
              >
                <UploadCloud className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <span>
                  {isBackingUpGoogle
                    ? (lang === 'bn' ? 'ব্যাকআপ হচ্ছে...' : 'Backing up...')
                    : (lang === 'bn' ? 'গুগলে ব্যাকআপ' : 'Backup to Google')}
                </span>
              </button>

              {/* Add New Contact Button */}
              <button
                type="button"
                data-testid="add-contact-header-btn"
                onClick={handleOpenAddContact}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'bn' ? 'নতুন কন্ট্যাক্ট' : 'Add Contact'}</span>
              </button>
            </div>
          </div>

          {/* Real-time Google Backup Progress Banner */}
          {backupProgress && (
            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 space-y-2">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                  <span>
                    {lang === 'bn'
                      ? `গুগল অ্যাকাউন্টে ব্যাকআপ হচ্ছে (${toBengaliDigits(backupProgress.current)}/${toBengaliDigits(backupProgress.total)})`
                      : `Backing up to Google (${backupProgress.current}/${backupProgress.total})`}
                  </span>
                </span>
                <span className="text-[11px] text-sky-700 dark:text-sky-400 truncate max-w-[150px]">
                  {backupProgress.currentName}
                </span>
              </div>
              <div className="w-full bg-sky-200 dark:bg-sky-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-sky-600 h-full transition-all duration-200"
                  style={{
                    width: `${(backupProgress.current / Math.max(1, backupProgress.total)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Duplicate Contacts Auto-Merge Banner */}
          {duplicateStats.duplicateCount > 0 && (
            <div
              data-testid="duplicate-contacts-banner"
              className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 shadow-xs flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <span>{lang === 'bn' ? 'ডুপ্লিকেট নম্বর শনাক্ত হয়েছে' : 'Duplicate Contacts Detected'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                      {toBengaliDigits(duplicateStats.duplicateCount)} টি
                    </span>
                  </h4>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 max-w-xl">
                    {lang === 'bn'
                      ? 'একই নম্বর বা তথ্যের একাধিক কন্ট্যাক্ট রয়েছে। এগুলোকে এক ক্লিকে একটি নিখুঁত কন্ট্যাক্টে মার্জ করুন।'
                      : 'Multiple contacts share the same phone number. Merge them into a single clean record.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="auto-merge-duplicates-btn"
                onClick={handleAutoMergeDuplicates}
                disabled={isMergingDuplicates}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold shadow-xs inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isMergingDuplicates ? 'animate-spin' : ''}`} />
                <span>
                  {isMergingDuplicates
                    ? (lang === 'bn' ? 'মার্জ হচ্ছে...' : 'Merging...')
                    : (lang === 'bn' ? 'ডুপ্লিকেট মার্জ করুন' : 'Merge Duplicates')}
                </span>
              </button>
            </div>
          )}

          {/* Search Bar & Category Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                data-testid="contact-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'নাম, ইংরেজি/বাংলা নম্বর (017... বা ০১৭১...), পদবি বা লাইন লিখে খুঁজুন...'
                    : 'Search by name, English/Bengali phone, designation, line...'
                }
                className="w-full min-h-[44px] pl-9.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  data-testid="clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors"
                  title={lang === 'bn' ? 'সার্চ মুছুন' : 'Clear search'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pt-1">
              <button
                type="button"
                data-testid="filter-all"
                onClick={() => setSelectedCategory('all')}
                className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {lang === 'bn' ? 'সকল কন্ট্যাক্ট' : 'All Contacts'}
              </button>

              <button
                type="button"
                data-testid="filter-favorites"
                onClick={() => setSelectedCategory('favorites')}
                className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                  selectedCategory === 'favorites'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{lang === 'bn' ? 'প্রিয় কন্ট্যাক্ট' : 'Favorites'}</span>
              </button>

              {WORKER_CONTACT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`filter-${cat.id}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {lang === 'bn' ? cat.labelBn : cat.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Contact Count and Quick Stats */}
          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <span>
                {lang === 'bn'
                  ? `মোট ${toBengaliDigits(filteredContacts.length)} টি কন্ট্যাক্ট প্রদর্শিত হচ্ছে`
                  : `Showing ${filteredContacts.length} contacts`}
              </span>
              {searchQuery && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold text-[10px]">
                  {lang === 'bn'
                    ? `${toBengaliDigits(filteredContacts.length)} টি ফলাফল`
                    : `${filteredContacts.length} matches`}
                </span>
              )}
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
              >
                {lang === 'bn' ? 'অনুসন্ধান মুছুন' : 'Clear search'}
              </button>
            )}
          </div>

          {/* Contact Cards Grid */}
          {filteredContacts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
              <Phone className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'কোনো কন্ট্যাক্ট পাওয়া যায়নি' : 'No contacts found'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? (lang === 'bn' ? 'আপনার অনুসন্ধানের সাথে মিল রেখে কোনো কন্ট্যাক্ট পাওয়া যায়নি।' : 'No contacts matching your search query.')
                  : (lang === 'bn' ? 'আপনার ব্যক্তিগত ফোনবুকে সুপারভাইজার, লাইন চিফ বা বন্ধুদের নম্বর যোগ করুন।' : 'Add your factory supervisor, line chief, or coworker numbers to your private phonebook.')}
              </p>
              <button
                type="button"
                onClick={handleOpenAddContact}
                className="mt-4 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'bn' ? 'নতুন কন্ট্যাক্ট যোগ করুন' : 'Add New Contact'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredContacts.map((contact) => {
                const meta = getCategoryMeta(contact.category, contact.customCategory);
                const waUrl = formatWhatsAppUrl(contact.phone);
                const telUrl = formatPhoneForCall(contact.phone);
                const engPhone = toEnglishDisplayPhone(contact.phone);

                return (
                  <div
                    key={contact.id}
                    data-testid={`contact-card-${contact.id}`}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between gap-3 relative"
                  >
                    <div>
                      {/* Top Bar: Category / Source Pill & Sync Indicator & Favorite Toggle */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {contact.customCategory ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800 inline-flex items-center gap-1">
                              <Sparkles className="w-3 h-3 shrink-0 text-teal-600" />
                              <span>{contact.customCategory}</span>
                            </span>
                          ) : contact.category === 'google' || contact.source === 'google' ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 inline-flex items-center gap-1">
                              <GoogleIcon className="w-3 h-3 shrink-0" />
                              <span>{lang === 'bn' ? 'ফ্রম গুগল' : 'From Google'}</span>
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.color}`}
                            >
                              {lang === 'bn' ? meta.labelBn : meta.labelEn}
                            </span>
                          )}

                          {contact.isPinned && (
                            <span
                              className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 inline-flex items-center gap-1 shadow-2xs"
                              title={lang === 'bn' ? 'পিন করা কন্ট্যাক্ট (উপরে রাখা)' : 'Pinned to top'}
                            >
                              <Pin className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-amber-500 shrink-0" />
                              <span>{lang === 'bn' ? 'পিন করা' : 'Pinned'}</span>
                            </span>
                          )}

                          {contact.isSyncedToGoogle && (
                            <span
                              className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                              title={lang === 'bn' ? 'গুগল অ্যাকাউন্টে ব্যাকআপ করা রয়েছে' : 'Synced to Google Contacts'}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{lang === 'bn' ? 'গুগলে সেভড' : 'Google Sync'}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {contact.isEmergency && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
                              {lang === 'bn' ? 'জরুরি' : 'Emergency'}
                            </span>
                          )}
                          <button
                            type="button"
                            data-testid={`pin-toggle-${contact.id}`}
                            onClick={() => handleTogglePinContact(contact)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                              contact.isPinned
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-300 dark:text-slate-600'
                            }`}
                            title={contact.isPinned ? (lang === 'bn' ? 'আনপিন করুন' : 'Unpin contact') : (lang === 'bn' ? 'উপরে পিন করুন' : 'Pin to top')}
                          >
                            <Pin
                              className={`w-4 h-4 ${
                                contact.isPinned
                                  ? 'text-amber-600 dark:text-amber-400 fill-amber-500'
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            data-testid={`fav-toggle-${contact.id}`}
                            onClick={() => toggleFavoriteContact(contact.id, !contact.isFavorite)}
                            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                            title={contact.isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                contact.isFavorite
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold shrink-0 text-base">
                          {contact.fullName.charAt(0) || <User className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {contact.fullName}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {contact.designation ||
                              contact.customCategory ||
                              (contact.source === 'google' || contact.category === 'google'
                                ? (lang === 'bn' ? 'ফ্রম গুগল' : 'From Google')
                                : (lang === 'bn' ? 'পদবী নেই' : 'No designation'))}
                            {contact.lineNumber && ` • ${contact.lineNumber}`}
                          </p>
                          {contact.department && (
                            <p className="text-[11px] text-slate-400 truncate">
                              {contact.department}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Phone Display with English Digits & Copy Button */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-wide font-mono truncate select-all">
                            {engPhone}
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid={`copy-phone-${contact.id}`}
                          onClick={() => handleCopyPhone(contact.phone, contact.id)}
                          className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                            copiedPhoneContactId === contact.id
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-650'
                          }`}
                          title={lang === 'bn' ? 'নম্বর কপি করুন' : 'Copy phone number'}
                        >
                          {copiedPhoneContactId === contact.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span className="text-[11px] font-bold">{lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[11px]">{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Notes snippet */}
                      {contact.notes && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                          &ldquo;{contact.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Action Buttons: 1-Tap Call, 1-Tap WhatsApp, Single Google Sync, Edit, Delete */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-1">
                        <a
                          href={telUrl}
                          data-testid={`call-btn-${contact.id}`}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs inline-flex items-center justify-center gap-1.5 flex-1 transition-colors"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>{lang === 'bn' ? 'কল করুন' : 'Call'}</span>
                        </a>

                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`whatsapp-btn-${contact.id}`}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs inline-flex items-center justify-center gap-1.5 flex-1 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-0.5">
                        {!contact.isSyncedToGoogle && (
                          <button
                            type="button"
                            onClick={() => handleUploadSingleContactToGoogle(contact)}
                            disabled={uploadingSingleContactId === contact.id}
                            className="w-9 h-9 rounded-xl text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 flex items-center justify-center transition-colors disabled:opacity-50"
                            title={lang === 'bn' ? 'গুগল অ্যাকাউন্টে সেভ করুন' : 'Save to Google Contacts'}
                          >
                            {uploadingSingleContactId === contact.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UploadCloud className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditContact(contact)}
                          className="w-9 h-9 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'contact',
                              id: contact.id,
                              title: `${contact.fullName} (${contact.phone})`,
                            })
                          }
                          className="w-9 h-9 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EMERGENCY (জরুরি কন্ট্যাক্ট) */}
      {/* ========================================================================= */}
      {activeTab === 'emergency' && (
        <div className="space-y-6">
          {/* Top Notice */}
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-950 dark:text-rose-200">
                {lang === 'bn' ? 'জরুরি প্রয়োজনে ১-ট্যাপে সরাসরি যোগাযোগ' : '1-Tap Direct Emergency Call'}
              </h3>
              <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">
                {lang === 'bn'
                  ? 'কারখানায় দুর্ঘটনা, আগুন, হঠাৎ অসুস্থতা বা বিপদে তাৎক্ষণিক সহায়তার জন্য নিচের নম্বরসমূহে সরাসরি কল করুন।'
                  : 'Call verified factory clinic, medical officers, and national emergency lines in seconds during crisis.'}
              </p>
            </div>
          </div>

          {/* User's Personal Emergency Contacts */}
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span>
                  {lang === 'bn'
                    ? 'আপনার চিহ্নিত জরুরি কন্ট্যাক্টসমূহ'
                    : 'Your Flagged Emergency Contacts'}
                </span>
              </h3>
              <button
                type="button"
                onClick={handleOpenAddContact}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'জরুরি কন্ট্যাক্ট যোগ' : 'Add Emergency Contact'}</span>
              </button>
            </div>

            {emergencyContactsList.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
                <p>
                  {lang === 'bn'
                    ? 'কোনো ব্যক্তিগত জরুরি কন্ট্যাক্ট চিহ্নিত করা নেই। ফ্যাক্টরি মেডিকেল রুম, অ্যাম্বুলেন্স বা পরিবারের নম্বর জরুরি হিসেবে চিহ্নিত করুন।'
                    : 'No emergency contacts flagged yet. Add your factory clinic, ambulance, or family numbers.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {emergencyContactsList.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
                          {lang === 'bn' ? 'জরুরি যোগাযোগ' : 'Emergency'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {c.department || c.lineNumber || ''}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {c.fullName}
                      </h4>
                      {c.designation && <p className="text-xs text-slate-500">{c.designation}</p>}
                      <div className="flex items-center justify-between gap-2 mt-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono tracking-wide">
                          {toEnglishDisplayPhone(c.phone)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(c.phone, c.id)}
                          className={`min-h-[28px] px-2 py-0.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                            copiedPhoneContactId === c.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                          }`}
                          title="Copy number"
                        >
                          {copiedPhoneContactId === c.id ? (
                            <>
                              <Check className="w-3 h-3 text-white" />
                              <span className="text-[10px]">{lang === 'bn' ? 'কপি!' : 'Copied'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[10px]">{lang === 'bn' ? 'কপি' : 'Copy'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <a
                      href={formatPhoneForCall(c.phone)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-xs inline-flex items-center justify-center gap-2 transition-colors"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'জরুরি কল করুন' : 'Emergency Call'}</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* National Verified Helplines */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 px-1">
              {lang === 'bn' ? 'জাতীয় জরুরি হটলাইন (টোল-ফ্রি ২৪ ঘণ্টা)' : 'National Emergency Hotlines (24/7)'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-rose-600">৯৯৯ (999)</span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {lang === 'bn' ? 'জাতীয় জরুরি সেবা' : 'National Emergency'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {lang === 'bn'
                      ? 'পুলিশ, ফায়ার সার্ভিস ও সরকারি অ্যাম্বুলেন্স সেবা'
                      : 'Police, Fire Service & Ambulance'}
                  </p>
                </div>
                <a
                  href="tel:999"
                  className="min-h-[42px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? '৯৯৯ এ কল করুন' : 'Call 999'}</span>
                </a>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-purple-600">১০৯ (109)</span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {lang === 'bn' ? 'নারী নির্যাতন প্রতিরোধ' : 'Women Helpline'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {lang === 'bn'
                      ? 'কর্মস্থলে হয়রানি ও নারী শ্রমিকদের সুরক্ষায় সরকারি সহায়তা'
                      : 'Workplace harassment & women protection helpline'}
                  </p>
                </div>
                <a
                  href="tel:109"
                  className="min-h-[42px] px-3.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? '১০৯ এ কল করুন' : 'Call 109'}</span>
                </a>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-emerald-600">১৬৪৩০ (16430)</span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {lang === 'bn' ? 'বিনামূল্যে আইনি সহায়তা' : 'Legal Aid Helpline'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {lang === 'bn'
                      ? 'শ্রম আইন, বকেয়া মজুরি ও ক্ষতিপূরণ সংক্রান্ত বিনামূল্যে আইনি পরামর্শ'
                      : 'Free government labor law consultation'}
                  </p>
                </div>
                <a
                  href="tel:16430"
                  className="min-h-[42px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? '১৬৪৩০ এ কল করুন' : 'Call 16430'}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WORKPLACE ADD/EDIT MODAL */}
      {/* ========================================================================= */}
      {workplaceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-5 sm:p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {editingWorkplaceId
                    ? (lang === 'bn' ? 'কর্মস্থল তথ্য সম্পাদনা' : 'Edit Workplace')
                    : (lang === 'bn' ? 'নতুন কর্মস্থল তথ্য যোগ' : 'Add New Workplace')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWorkplaceModalOpen(false)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkplaceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'গার্মেন্টস / কারখানার নাম *' : 'Garment Factory Name *'}
                </label>
                <input
                  type="text"
                  data-testid="wp-factory-name-input"
                  value={wpFactoryName}
                  onChange={(e) => setWpFactoryName(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: প্যাসিফিক জিন্স লিমিটেড' : 'e.g. Pacific Jeans Ltd.'}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'কারখানার এলাকা / অবস্থান' : 'Factory Area / Location'}
                  </label>
                  <input
                    type="text"
                    value={wpFactoryArea}
                    onChange={(e) => setWpFactoryArea(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: গাজীপুর, আশুলিয়া, সাভার' : 'e.g. Gazipur, Ashulia'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'কারখানার পূর্ণ ঠিকানা' : 'Factory Address'}
                  </label>
                  <input
                    type="text"
                    value={wpFactoryAddress}
                    onChange={(e) => setWpFactoryAddress(e.target.value)}
                    placeholder={lang === 'bn' ? 'রোড / প্লট / শিল্প এলাকা' : 'Road / Industrial Area'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'ডিপার্টমেন্ট / সেকশন' : 'Department / Section'}
                  </label>
                  <input
                    type="text"
                    value={wpDepartment}
                    onChange={(e) => setWpDepartment(e.target.value)}
                    placeholder={lang === 'bn' ? 'সুইং, কাটিং, ফিনিশিং' : 'Sewing, Cutting'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'ফ্লোর নম্বর' : 'Floor Number'}
                  </label>
                  <input
                    type="text"
                    value={wpFloorNumber}
                    onChange={(e) => setWpFloorNumber(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: ৩য় তলা' : 'e.g. 3rd Floor'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'লাইন নম্বর' : 'Line Number'}
                  </label>
                  <input
                    type="text"
                    value={wpLineNumber}
                    onChange={(e) => setWpLineNumber(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: লাইন-১২' : 'e.g. Line-12'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'আপনার পদবী (Job Role)' : 'Designation / Job Role'}
                  </label>
                  <input
                    type="text"
                    value={wpDesignation}
                    onChange={(e) => setWpDesignation(e.target.value)}
                    placeholder={lang === 'bn' ? 'সিনিয়র অপারেটর / কোয়ালিটি' : 'Senior Operator / QC'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'সুপারভাইজারের নাম (ঐচ্ছিক)' : 'Supervisor Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={wpSupervisorName}
                    onChange={(e) => setWpSupervisorName(e.target.value)}
                    placeholder={lang === 'bn' ? 'সুপারভাইজারের নাম' : 'Supervisor name'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'যোগদানের তারিখ (ঐচ্ছিক)' : 'Joining Date (Optional)'}
                  </label>
                  <input
                    type="date"
                    value={wpJoiningDate}
                    onChange={(e) => setWpJoiningDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'ফ্যাক্টরি ফোন / হটলাইন (ঐচ্ছিক)' : 'Factory Phone (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={wpFactoryPhone}
                    onChange={(e) => setWpFactoryPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'অতিরিক্ত মন্তব্য বা নোট (ঐচ্ছিক)' : 'Additional Notes (Optional)'}
                </label>
                <textarea
                  value={wpNotes}
                  onChange={(e) => setWpNotes(e.target.value)}
                  rows={2}
                  placeholder={lang === 'bn' ? 'যেমন: বায়ার অর্ডার, শিফট বা গেট সংক্রান্ত নোট' : 'Any notes...'}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs"
                />
              </div>

              {/* Is Current Checkbox */}
              <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="wp-is-current-checkbox"
                  checked={wpIsCurrent}
                  onChange={(e) => setWpIsCurrent(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {lang === 'bn'
                    ? 'এটি আমার বর্তমান কর্মস্থল (কারখানা প্রোফাইলে সক্রিয় হিসেবে থাকবে)'
                    : 'This is my current workplace (active factory)'}
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWorkplaceModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  data-testid="wp-save-btn"
                  className="min-h-[44px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors"
                >
                  {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Workplace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONTACT ADD/EDIT MODAL */}
      {/* ========================================================================= */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {editingContactId
                    ? (lang === 'bn' ? 'কন্ট্যাক্ট সম্পাদনা' : 'Edit Contact')
                    : (lang === 'bn' ? 'নতুন কন্ট্যাক্ট সংরক্ষণ' : 'Add New Contact')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContactSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'পূর্ণ নাম * (আবশ্যক)' : 'Full Name * (Required)'}
                </label>
                <input
                  type="text"
                  data-testid="contact-name-input"
                  value={ctFullName}
                  onChange={(e) => setCtFullName(e.target.value)}
                  placeholder={lang === 'bn' ? 'যেমন: মোঃ সোহেল রানা' : 'e.g. Md. Sohel Rana'}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর * (আবশ্যক)' : 'Phone Number * (Required)'}
                  </label>
                  <input
                    type="text"
                    data-testid="contact-phone-input"
                    value={ctPhone}
                    onChange={(e) => setCtPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 text-sm font-bold font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {lang === 'bn' ? 'বাংলাদেশী ১১ ডিজিট (013-019) বা হটলাইন' : 'Bangladeshi 11 digits (013-019)'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'ক্যাটাগরি / সম্পর্ক *' : 'Category / Relationship *'}
                  </label>
                  <select
                    data-testid="contact-category-select"
                    value={ctCategory}
                    onChange={(e) => {
                      const val = e.target.value as WorkerContactCategory;
                      setCtCategory(val);
                      if (val !== 'other') {
                        setCtCustomCategory('');
                      }
                    }}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-semibold"
                  >
                    {WORKER_CONTACT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id === 'other'
                          ? (lang === 'bn' ? 'কাস্টম / অন্যান্য সম্পর্ক লিখুন...' : 'Custom / Other Relationship...')
                          : (lang === 'bn' ? c.labelBn : c.labelEn)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Relationship / Category Write-in field */}
              {ctCategory === 'other' && (
                <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>{lang === 'bn' ? 'কাস্টম সম্পর্ক বা পদবি লিখুন' : 'Write Custom Relationship / Role'}</span>
                    </label>
                    <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
                      {lang === 'bn' ? 'নিজের মতো লিখুন' : 'Custom'}
                    </span>
                  </div>
                  <input
                    type="text"
                    data-testid="contact-custom-category-input"
                    value={ctCustomCategory}
                    onChange={(e) => setCtCustomCategory(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'যেমন: ফ্লোর ম্যানেজার, হেড মেকানিক, কাটিং মাস্টার, রুমমেট...'
                        : 'e.g. Floor Manager, Head Mechanic, Roommate...'
                    }
                    className="w-full min-h-[44px] rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-800 px-3.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                  />
                  {/* Quick Preset Tags for Garment Workers */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-teal-800 dark:text-teal-300 font-semibold">
                      {lang === 'bn' ? 'জনপ্রিয় পদবি:' : 'Suggestions:'}
                    </span>
                    {['মেকানিক', 'কাটিং মাস্টার', 'কিউসি (QC)', 'স্যাম্পলম্যান', 'রুমমেট', 'ফ্লোর ইনচার্জ'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setCtCustomCategory(chip)}
                        className="px-2 py-0.5 rounded-lg text-[11px] bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-300 font-medium hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors cursor-pointer"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'পদবি (ঐচ্ছিক)' : 'Designation (Optional)'}
                  </label>
                  <input
                    type="text"
                    data-testid="contact-designation-input"
                    value={ctDesignation}
                    onChange={(e) => setCtDesignation(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: সিনিয়র অপারেটর' : 'e.g. Senior Operator'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'ডিপার্টমেন্ট (ঐচ্ছিক)' : 'Department (Optional)'}
                  </label>
                  <input
                    type="text"
                    data-testid="contact-department-input"
                    value={ctDepartment}
                    onChange={(e) => setCtDepartment(e.target.value)}
                    placeholder={lang === 'bn' ? 'সুইং সেকশন' : 'Sewing section'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'লাইন নম্বর (ঐচ্ছিক)' : 'Line Number (Optional)'}
                  </label>
                  <input
                    type="text"
                    data-testid="contact-line-input"
                    value={ctLineNumber}
                    onChange={(e) => setCtLineNumber(e.target.value)}
                    placeholder={lang === 'bn' ? 'লাইন-বি৪' : 'Line-B4'}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'bn' ? 'নোট বা প্রয়োজনীয় নির্দেশনা (ঐচ্ছিক)' : 'Additional Notes (Optional)'}
                </label>
                <textarea
                  value={ctNotes}
                  onChange={(e) => setCtNotes(e.target.value)}
                  rows={2}
                  placeholder={lang === 'bn' ? 'যেমন: ছুটি বা ওভারটাইম অনুমতির জন্য যোগাযোগ (ঐচ্ছিক)' : 'Notes... (Optional)'}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="contact-pin-checkbox"
                    checked={ctIsPinned}
                    onChange={(e) => setCtIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-semibold text-amber-950 dark:text-amber-200 flex items-center gap-1">
                    <Pin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-amber-500" />
                    <span>{lang === 'bn' ? 'উপরে পিন করুন' : 'Pin to Top'}</span>
                  </span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="contact-favorite-checkbox"
                    checked={ctIsFavorite}
                    onChange={(e) => setCtIsFavorite(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{lang === 'bn' ? 'প্রিয় কন্ট্যাক্ট' : 'Favorite'}</span>
                  </span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="contact-emergency-checkbox"
                    checked={ctIsEmergency}
                    onChange={(e) => setCtIsEmergency(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>{lang === 'bn' ? 'জরুরি কন্ট্যাক্ট' : 'Emergency'}</span>
                  </span>
                </label>
              </div>

              {/* Direct Save to Google Account Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="contact-save-to-google-checkbox"
                  checked={saveToGoogleAccount}
                  onChange={(e) => setSaveToGoogleAccount(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sky-950 dark:text-sky-200">
                    <GoogleIcon className="w-4 h-4 shrink-0" />
                    <span>{lang === 'bn' ? 'গুগল অ্যাকাউন্টেও সংরক্ষণ করুন' : 'Save to Google Account as well'}</span>
                  </div>
                  <p className="text-[11px] text-sky-700/90 dark:text-sky-400 mt-0.5">
                    {lang === 'bn'
                      ? 'নাম্বারটি সরাসরি আপনার গুগল কন্ট্যাক্টস অ্যাকাউন্টে সিঙ্ক ও ব্যাকআপ হয়ে যাবে'
                      : 'Directly syncs and backs up this number to your personal Google Contacts'}
                  </p>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  data-testid="contact-save-btn"
                  className="min-h-[44px] px-6 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors"
                >
                  {lang === 'bn' ? 'কন্ট্যাক্ট সংরক্ষণ করুন' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {deleteConfirm.type === 'workplace'
                  ? (lang === 'bn' ? 'কর্মস্থল মুছে ফেলতে চান?' : 'Delete Workplace?')
                  : (lang === 'bn' ? 'কন্ট্যাক্ট মুছে ফেলতে চান?' : 'Delete Contact?')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2">
                {lang === 'bn'
                  ? `আপনি কি নিশ্চিতভাবে “${deleteConfirm.title}” মুছে ফেলতে চান? মুছে ফেলা তথ্যটি ডাটা এডিটিং হিস্ট্রি থেকে চাইলে পুনরুদ্ধার করা যাবে।`
                  : `Are you sure you want to delete "${deleteConfirm.title}"? You can restore it later from the Edit History.`}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="min-h-[44px] px-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                {lang === 'bn' ? 'না, বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                data-testid="confirm-delete-btn"
                onClick={handleConfirmDelete}
                className="min-h-[44px] px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors"
              >
                {lang === 'bn' ? 'হ্যাঁ, মুছে ফেলুন' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GOOGLE CONTACTS BACKUP ALL CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {backupConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 flex items-center justify-center mx-auto">
              <GoogleIcon className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'সকল কন্ট্যাক্ট গুগলে ব্যাকআপ করতে চান?' : 'Backup all contacts to Google?'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2">
                {lang === 'bn'
                  ? `আপনার শ্রমিক সাথী অ্যাপের মোট ${toBengaliDigits(contacts.length)} টি কন্ট্যাক্ট নম্বর আপনার গুগল অ্যাকাউন্টে ব্যাকআপ ও সিঙ্ক করা হবে। আপনি কি নিশ্চিত?`
                  : `All ${contacts.length} contacts saved in Shromik Sathi will be uploaded and backed up to your Google Contacts account. Are you sure?`}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBackupConfirmOpen(false)}
                className="min-h-[44px] px-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="button"
                data-testid="confirm-backup-all-btn"
                onClick={handleBackupAllToGoogle}
                className="min-h-[44px] px-6 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{lang === 'bn' ? 'হ্যাঁ, ব্যাকআপ শুরু করুন' : 'Confirm & Backup'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
