import type { FeedbackCategory, Language, SupportFeedback } from '../types';
import type { SupportTicketRecord } from './adminLogic';

export interface SupportCategoryOption {
  id: FeedbackCategory;
  labelBn: string;
  labelEn: string;
  placeholderBn: string;
  placeholderEn: string;
}

export const SUPPORT_CATEGORIES: SupportCategoryOption[] = [
  {
    id: 'calculation_help',
    labelBn: 'বেতন ও ওভারটাইম হিসাব',
    labelEn: 'Salary & Overtime Help',
    placeholderBn: 'আপনার বেতন বা ওভারটাইম হিসাব নিয়ে কী জানতে চান লিখুন...',
    placeholderEn: 'Describe your salary or overtime calculation question...',
  },
  {
    id: 'bug_report',
    labelBn: 'কারিগরি সমস্যা',
    labelEn: 'Technical Issue',
    placeholderBn: 'অ্যাপের কোন অংশে সমস্যা হচ্ছে তা সংক্ষেপে লিখুন...',
    placeholderEn: 'Briefly describe the issue you encountered...',
  },
  {
    id: 'feature_request',
    labelBn: 'নতুন সুবিধার অনুরোধ',
    labelEn: 'Feature Request',
    placeholderBn: 'অ্যাপে কোন নতুন সুবিধা যোগ করলে আপনার উপকার হবে লিখুন...',
    placeholderEn: 'Tell us what new feature would help you most...',
  },
  {
    id: 'general',
    labelBn: 'সাধারণ সহায়তা',
    labelEn: 'General Support',
    placeholderBn: 'আপনার প্রশ্ন বা পরামর্শ এখানে লিখুন...',
    placeholderEn: 'Write your question or feedback here...',
  },
];

export interface SupportQuickPrompt {
  id: string;
  category: FeedbackCategory;
  chipBn: string;
  chipEn: string;
  templateBn: string;
  templateEn: string;
}

export const SUPPORT_QUICK_PROMPTS: SupportQuickPrompt[] = [
  {
    id: 'ot_mismatch',
    category: 'calculation_help',
    chipBn: 'ওভারটাইম হিসাব মিলছে না',
    chipEn: 'OT calculation mismatch',
    templateBn: 'আমার এই মাসের ওভারটাইম ঘণ্টা ও টাকার হিসাব পে-স্লিপের সাথে মিলছে না। অনুগ্রহ করে যাচাই করতে সহায়তা করুন।',
    templateEn: 'My monthly overtime hours and earnings do not match my factory payslip. Please help verify.',
  },
  {
    id: 'bonus_check',
    category: 'calculation_help',
    chipBn: 'হাজিরা বোনাস যোগ হয়নি',
    chipEn: 'Attendance bonus missing',
    templateBn: 'নিয়মিত উপস্থিত থাকার পরও আমার হাজিরা বোনাস হিসাব করা যাচ্ছে না।',
    templateEn: 'My attendance bonus is not showing even though I attended regularly.',
  },
  {
    id: 'sync_issue',
    category: 'bug_report',
    chipBn: 'অফলাইন ডেটা সিঙ্ক সমস্যা',
    chipEn: 'Offline sync issue',
    templateBn: 'ইন্টারনেট চালু করার পরও অফলাইনে সেভ করা তথ্য সিঙ্ক হতে সময় নিচ্ছে।',
    templateEn: 'Records saved offline are taking too long to sync after reconnecting.',
  },
  {
    id: 'payslip_pdf',
    category: 'feature_request',
    chipBn: 'পে-স্লিপ ও রিপোর্ট সহায়তা',
    chipEn: 'Payslip & report help',
    templateBn: 'মাসিক বেতন ও ওভারটাইম রিপোর্ট সহজে শেয়ার করার বিষয়ে সহায়তা চাই।',
    templateEn: 'I need help exporting or sharing my monthly salary and overtime report.',
  },
];

export interface SupportFaqItem {
  id: string;
  questionBn: string;
  questionEn: string;
  answerBn: string;
  answerEn: string;
}

export const SUPPORT_FAQS: SupportFaqItem[] = [
  {
    id: 'faq_ot_rate',
    questionBn: 'ওভারটাইম রেট কীভাবে হিসাব করা হয়?',
    questionEn: 'How is the overtime hourly rate calculated?',
    answerBn:
      'বাংলাদেশ শ্রম আইন (ধারা ১০৮) অনুযায়ী ঘণ্টার ওভারটাইম হার = (মূল বেতন ÷ ২০৮) × ২। চাইলে ওভারটাইম ট্যাব থেকে নিজের কারখানার রেট কাস্টমাইজও করতে পারবেন।',
    answerEn:
      'Under Bangladesh Labor Act (Sec 108), Hourly OT Rate = (Basic Salary ÷ 208) × 2. You can also set a custom rate inside the Overtime tab.',
  },
  {
    id: 'faq_offline',
    questionBn: 'ইন্টারনেট ছাড়া তথ্য সেভ করলে কি নিরাপদ থাকবে?',
    questionEn: 'Are my records safe if saved without internet?',
    answerBn:
      'হ্যাঁ, ইন্টারনেট না থাকলেও আপনার সব হাজিরা, ওভারটাইম ও খরচের হিসাব ফোনে নিরাপদে জমা থাকে এবং অনলাইনে এলেই স্বয়ংক্রিয়ভাবে সিঙ্ক হয়ে যায়।',
    answerEn:
      'Yes. All entries saved offline stay safely stored on your device and sync automatically as soon as your connection returns.',
  },
  {
    id: 'faq_privacy',
    questionBn: 'আমার বেতন ও ব্যক্তিগত কাগজপত্র কি অন্য কেউ দেখতে পারে?',
    questionEn: 'Can anyone else view my salary or private documents?',
    answerBn:
      'না। আপনার বেতন, ওভারটাইম, কন্টাক্ট এবং ডকুমেন্ট ভল্টের তথ্য শুধুমাত্র আপনার নিজের অ্যাকাউন্টেই সুরক্ষিত থাকে।',
    answerEn:
      'No. Your salary, overtime, contacts, and document vault items are strictly isolated to your own account.',
  },
];

export const ADMIN_QUICK_REPLIES = [
  {
    id: 'qr_verified',
    labelBn: 'হিসাব যাচাই করা হয়েছে',
    labelEn: 'Calculation verified',
    textBn: 'ধন্যবাদ। আপনার প্রদত্ত তথ্য যাচাই করা হয়েছে—শ্রম আইন অনুযায়ী (মূল বেতন ÷ ২০৮) × ২ হারে ওভারটাইম সঠিকভাবে হিসাব হয়েছে।',
    textEn: 'Thank you. We verified your entry—overtime is calculated accurately using (Basic ÷ 208) × 2.',
  },
  {
    id: 'qr_profile',
    labelBn: 'প্রোফাইল বেতন আপডেট করুন',
    labelEn: 'Update basic salary',
    textBn: 'অনুগ্রহ করে প্রোফাইল সেকশন থেকে আপনার সর্বশেষ মূল বেতন ও হাজিরা বোনাস আপডেট করে পুনরায় সংরক্ষণ করুন।',
    textEn: 'Please update your latest Basic Salary and Attendance Bonus from Worker Profile and save again.',
  },
  {
    id: 'qr_sync',
    labelBn: 'সিঙ্ক পরামর্শ',
    labelEn: 'Sync guidance',
    textBn: 'অনুগ্রহ করে স্থিতিশীল ইন্টারনেট সংযোগে অ্যাপটি কিছুক্ষণ খোলা রাখুন অথবা উপরে ডানদিকে সিঙ্ক আইকন পরীক্ষা করুন।',
    textEn: 'Please keep the app open briefly with a stable internet connection to finish syncing offline records.',
  },
];

export function getFeedbackCategoryLabel(category: FeedbackCategory, lang: Language): string {
  const match = SUPPORT_CATEGORIES.find((c) => c.id === category);
  if (!match) return lang === 'bn' ? 'সাধারণ সহায়তা' : 'General Support';
  return lang === 'bn' ? match.labelBn : match.labelEn;
}

export function filterWorkerFeedback(
  items: SupportFeedback[],
  statusFilter: 'all' | 'open' | 'resolved',
  searchQuery = ''
): SupportFeedback[] {
  const q = searchQuery.trim().toLowerCase();
  return items.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (q) {
      return (
        item.message.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function computeSupportTicketCounts(tickets: SupportTicketRecord[]): {
  total: number;
  newCount: number;
  inProgress: number;
  resolved: number;
} {
  let newCount = 0;
  let inProgress = 0;
  let resolved = 0;

  for (const t of tickets) {
    if (t.status === 'new') newCount += 1;
    else if (t.status === 'in_progress' || t.status === 'waiting_for_user') inProgress += 1;
    else if (t.status === 'resolved' || t.status === 'closed') resolved += 1;
  }

  return {
    total: tickets.length,
    newCount,
    inProgress,
    resolved,
  };
}
