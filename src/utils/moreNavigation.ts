import type { MoreSubView } from '../types';

export type MoreNavGroupId = 'personal_tools' | 'finance_docs' | 'rules_account';

export interface MoreNavMetaItem {
  id: MoreSubView;
  group: MoreNavGroupId;
  labelBn: string;
  labelEn: string;
  requiresAdmin?: boolean;
}

export interface MoreNavGroupMeta {
  id: MoreNavGroupId;
  titleBn: string;
  titleEn: string;
}

export interface GroupedMoreNavSection<T extends { id: MoreSubView } = MoreNavMetaItem>
  extends MoreNavGroupMeta {
  items: T[];
}

export const MORE_NAV_GROUPS: ReadonlyArray<MoreNavGroupMeta> = [
  {
    id: 'personal_tools',
    titleBn: 'ব্যক্তিগত ও কাজের সরঞ্জাম',
    titleEn: 'Personal & Tools',
  },
  {
    id: 'finance_docs',
    titleBn: 'বেতন, হিসাব ও কাগজপত্র',
    titleEn: 'Finance & Documents',
  },
  {
    id: 'rules_account',
    titleBn: 'আইন, সহায়তা ও অ্যাকাউন্ট',
    titleEn: 'Law, Support & Account',
  },
];

export const MORE_NAV_ITEMS: ReadonlyArray<MoreNavMetaItem> = [
  {
    id: 'profile',
    group: 'personal_tools',
    labelBn: 'শ্রমিক প্রোফাইল',
    labelEn: 'Worker Profile',
  },
  {
    id: 'alarm',
    group: 'personal_tools',
    labelBn: 'অ্যালার্ম',
    labelEn: 'Alarm',
  },
  {
    id: 'calculator',
    group: 'personal_tools',
    labelBn: 'বেতন ও সুবিধা ক্যালকুলেটর',
    labelEn: 'Salary & Benefits Calculator',
  },
  {
    id: 'contacts',
    group: 'personal_tools',
    labelBn: 'গার্মেন্টস ও কন্ট্যাক্ট বুক',
    labelEn: 'Garment & Contacts',
  },
  {
    id: 'factory',
    group: 'personal_tools',
    labelBn: 'কারখানা ও শিফট',
    labelEn: 'Factory & Shift',
  },
  {
    id: 'salary',
    group: 'finance_docs',
    labelBn: 'বেতন ও পে-স্লিপ',
    labelEn: 'Salary & Payslip',
  },
  {
    id: 'finance',
    group: 'finance_docs',
    labelBn: 'ব্যক্তিগত হিসাব',
    labelEn: 'Personal Finance',
  },
  {
    id: 'personal_loans',
    group: 'finance_docs',
    labelBn: 'ধার-দেনা ও ঋণ হিসাব',
    labelEn: 'Personal Loans & Debt',
  },
  {
    id: 'documents',
    group: 'finance_docs',
    labelBn: 'কাগজপত্র ভল্ট',
    labelEn: 'Document Vault',
  },
  {
    id: 'reports',
    group: 'finance_docs',
    labelBn: 'রিপোর্টসমূহ',
    labelEn: 'Reports & Backup',
  },
  {
    id: 'reminders',
    group: 'rules_account',
    labelBn: 'রিমাইন্ডার ও আইন',
    labelEn: 'Reminders & Law',
  },
  {
    id: 'announcements',
    group: 'rules_account',
    labelBn: 'অ্যাডমিন নোটিশ',
    labelEn: 'Announcements',
  },
  {
    id: 'support',
    group: 'rules_account',
    labelBn: 'সহায়তা ও নীতিমালা',
    labelEn: 'Support & Privacy',
  },
  {
    id: 'subscriptions',
    group: 'rules_account',
    labelBn: 'সাবস্ক্রিপশন ও প্ল্যান',
    labelEn: 'Subscriptions & Plans',
  },
  {
    id: 'admin_panel',
    group: 'rules_account',
    labelBn: 'অ্যাডমিন ড্যাশবোর্ড',
    labelEn: 'Admin Dashboard',
    requiresAdmin: true,
  },
];

export function buildGroupedMoreNav<T extends { id: MoreSubView }>(
  items: ReadonlyArray<T>,
  isAdminUser: boolean
): GroupedMoreNavSection<T>[] {
  const itemById = new Map<MoreSubView, T>();
  for (const item of items) {
    itemById.set(item.id, item);
  }

  return MORE_NAV_GROUPS.map((group) => {
    const groupMetaItems = MORE_NAV_ITEMS.filter(
      (meta) => meta.group === group.id && (!meta.requiresAdmin || isAdminUser)
    );
    const matchedItems: T[] = [];
    for (const meta of groupMetaItems) {
      const found = itemById.get(meta.id);
      if (found) matchedItems.push(found);
    }
    return {
      ...group,
      items: matchedItems,
    };
  }).filter((section) => section.items.length > 0);
}
