import type { Language } from '../types';

export interface TermsSection {
  id: string;
  headingBn: string;
  headingEn: string;
  introBn?: string;
  introEn?: string;
  bulletsBn?: string[];
  bulletsEn?: string[];
}

export const TERMS_EFFECTIVE_DATE_BN = '১৬ নভেম্বর, ২০২৬';
export const TERMS_EFFECTIVE_DATE_EN = '16 November, 2026';

export const TERMS_HIGHLIGHT_BULLETS_BN: string[] = [
  'অ্যাকাউন্টের নিরাপত্তা এবং এর মাধ্যমে পরিচালিত সকল কার্যক্রমের জন্য আপনি নিজেই দায়বদ্ধ।',
  'অননুমোদিত বা আইনবিরোধী কনটেন্ট আপলোড করা যাবে না।',
  'আমরা যেকোনো সময় শর্তাবলী পরিবর্তন করার অধিকার সংরক্ষণ করি।',
];

export const TERMS_HIGHLIGHT_BULLETS_EN: string[] = [
  'You are solely responsible for your account security and all activities conducted through it.',
  'Unauthorized or unlawful content must not be uploaded.',
  'We reserve the right to update or modify these terms at any time.',
];

export const TERMS_OF_SERVICE_SECTIONS: TermsSection[] = [
  {
    id: 'purpose',
    headingBn: '১. অ্যাপসের উদ্দেশ্য',
    headingEn: '1. Purpose of the App',
    introBn:
      'শ্রমিক সাথী অ্যাপস গার্মেন্টস খাতে কর্মরত শ্রমিকদের জন্য একটি ডিজিটাল মজুরি গণনা ও বিশ্লেষণ প্ল্যাটফর্ম, যা বাংলাদেশ শ্রম আইন ২০০৬-এর সাধারণ নীতিমালার আলোকে বিভিন্ন হিসাব নিরূপণে সহায়তা করে।',
    introEn:
      'Shromik Sathi is a digital wage calculation and analytics platform for garment sector workers, helping calculate various entitlements in light of general principles of the Bangladesh Labour Act 2006.',
  },
  {
    id: 'registration',
    headingBn: '২. ব্যবহারকারী নিবন্ধন ও অ্যাকাউন্ট নিরাপত্তা',
    headingEn: '2. User Registration & Account Security',
    bulletsBn: [
      'অ্যাপস ব্যবহারের জন্য প্রত্যেক ব্যবহারকারীকে সঠিক ও হালনাগাদ তথ্য প্রদানপূর্বক নিবন্ধন সম্পন্ন করতে হবে।',
      'ব্যবহারকারীর অ্যাকাউন্ট সংক্রান্ত লগইন তথ্যের গোপনীয়তা রক্ষা করা সম্পূর্ণরূপে ব্যবহারকারীর নিজস্ব দায়িত্ব।',
      'একাউন্টের মাধ্যমে সংঘটিত সকল কার্যক্রমের দায়ভার সংশ্লিষ্ট ব্যবহারকারীর উপর বর্তাবে।',
    ],
    bulletsEn: [
      'Each user must complete registration by providing accurate and up-to-date information.',
      'Maintaining the confidentiality of login credentials is the sole responsibility of the user.',
      'All activities performed through an account remain the responsibility of the respective user.',
    ],
  },
  {
    id: 'accuracy',
    headingBn: '৩. তথ্য প্রদান ও নির্ভুলতা',
    headingEn: '3. Data Input & Accuracy',
    bulletsBn: [
      'ব্যবহারকারী কর্তৃক প্রদত্ত তথ্যের ভিত্তিতেই অ্যাপস স্বয়ংক্রিয়ভাবে হিসাব ও রিপোর্ট প্রস্তুত করে।',
      'ভুল, অসম্পূর্ণ বা বিভ্রান্তিকর তথ্য প্রদান করলে তার ফলাফলও তদনুযায়ী ভ্রান্ত হতে পারে।',
      'এ ধরনের কোনো ফলাফলের জন্য অ্যাপস কর্তৃপক্ষ দায়বদ্ধ থাকবে না।',
    ],
    bulletsEn: [
      'The app automatically generates calculations and reports based on information entered by the user.',
      'Providing inaccurate, incomplete, or misleading data may result in inaccurate outputs.',
      'The app authority shall not be liable for results arising from inaccurate user inputs.',
    ],
  },
  {
    id: 'services',
    headingBn: '৪. প্রদত্ত সেবাসমূহ',
    headingEn: '4. Services Provided',
    introBn: 'অ্যাপসটি নিম্নোক্ত কার্যাবলী সম্পাদনে সহায়তা প্রদান করে:',
    introEn: 'The app assists in performing the following calculations and workflows:',
    bulletsBn: [
      'মাসিক মজুরি হিসাব নিরূপণ',
      'দৈনিক উপার্জনের ড্যাশবোর্ড প্রদর্শন',
      'বার্ষিক ডাটা সংরক্ষণ ও বিশ্লেষণ',
      'ইনক্রিমেন্ট হিসাব ও রিপোর্টিং',
      'পে-স্লিপ, জব কার্ড ও স্যালারি রিপোর্ট প্রস্তুত',
      'ছুটি ব্যবস্থাপনা (Leave Management)',
      'সার্ভিস বেনিফিট হিসাব',
      'মাতৃত্বকালীন সুবিধা নিরূপণ',
      'মৃত্যুজনিত ক্ষতিপূরণ হিসাব',
      'অর্জিত ছুটির হিসাব (Earned Leave)',
    ],
    bulletsEn: [
      'Monthly wage and salary calculation',
      'Daily earnings dashboard display',
      'Annual data storage and analysis',
      'Increment calculation and reporting',
      'Pay-slip, job card, and salary report preparation',
      'Leave Management',
      'Service benefit calculation',
      'Maternity benefit estimation',
      'Death compensation calculation',
      'Earned Leave calculation',
    ],
  },
  {
    id: 'limitations',
    headingBn: '৫. সীমাবদ্ধতা ও প্রযোজ্যতা',
    headingEn: '5. Limitations & Applicability',
    bulletsBn: [
      'প্রতিটি প্রতিষ্ঠান নিজস্ব নীতিমালা ও কাঠামোর ভিত্তিতে পরিচালিত হয়; ফলে অ্যাপসের ফলাফল সকল প্রতিষ্ঠানের নীতির সাথে সম্পূর্ণ সামঞ্জস্যপূর্ণ নাও হতে পারে।',
      'এই অ্যাপস কেবলমাত্র একটি সহায়ক গণনা টুল হিসেবে ব্যবহারের জন্য প্রণীত; এটি কোনো অফিসিয়াল বা আইনগত সিদ্ধান্তের বিকল্প নয়।',
    ],
    bulletsEn: [
      'Each organization operates under its own policies and wage structure; therefore app results may not match every factory policy completely.',
      'This app is intended solely as a supportive calculation tool and is not a substitute for official or legal decisions.',
    ],
  },
  {
    id: 'liability',
    headingBn: '৬. দায়বদ্ধতা সীমাবদ্ধতা',
    headingEn: '6. Limitation of Liability',
    bulletsBn: [
      'ব্যবহারকারী প্রদত্ত তথ্য এবং তার ভিত্তিতে প্রাপ্ত ফলাফল ও রিপোর্টের সম্পূর্ণ দায়ভার ব্যবহারকারীর উপর বর্তাবে।',
      'অ্যাপস কর্তৃপক্ষ কোনো প্রত্যক্ষ বা পরোক্ষ আর্থিক, আইনগত বা প্রশাসনিক ক্ষতির জন্য দায়ী থাকবে না।',
    ],
    bulletsEn: [
      'The user bears full responsibility for entered data and the resulting reports and calculations.',
      'The app authority shall not be liable for any direct or indirect financial, legal, or administrative loss.',
    ],
  },
  {
    id: 'acceptable-use',
    headingBn: '৭. ব্যবহার নীতিমালা',
    headingEn: '7. Acceptable Use Policy',
    bulletsBn: [
      'অ্যাপস কোনো অবৈধ, প্রতারণামূলক বা অসাধু উদ্দেশ্যে ব্যবহার করা কঠোরভাবে নিষিদ্ধ।',
      'অ্যাপসের স্বাভাবিক কার্যক্রম ব্যাহত করে এমন কোনো কর্মকাণ্ড গ্রহণযোগ্য নয়।',
    ],
    bulletsEn: [
      'Using the app for any unlawful, fraudulent, or dishonest purpose is strictly prohibited.',
      'Any activity that disrupts the normal operation of the app is unacceptable.',
    ],
  },
  {
    id: 'termination',
    headingBn: '৮. একাউন্ট স্থগিত বা বাতিল',
    headingEn: '8. Account Suspension or Termination',
    bulletsBn: [
      'শর্তাবলী লঙ্ঘনের ক্ষেত্রে কর্তৃপক্ষ কোনো পূর্ব নোটিশ ছাড়াই ব্যবহারকারীর একাউন্ট স্থগিত বা বাতিল করার অধিকার সংরক্ষণ করে।',
    ],
    bulletsEn: [
      'In case of violation of these terms, the authority reserves the right to suspend or terminate a user account without prior notice.',
    ],
  },
  {
    id: 'changes',
    headingBn: '৯. শর্তাবলীর পরিবর্তন',
    headingEn: '9. Changes to Terms',
    bulletsBn: [
      'কর্তৃপক্ষ প্রয়োজনবোধে যেকোনো সময় এই শর্তাবলী সংশোধন, পরিমার্জন বা হালনাগাদ করতে পারে।',
      'সংশোধিত শর্তাবলী অ্যাপে প্রকাশের সাথে সাথে কার্যকর বলে গণ্য হবে।',
    ],
    bulletsEn: [
      'The authority may revise, amend, or update these terms at any time if necessary.',
      'Updated terms take effect immediately upon publication in the app.',
    ],
  },
];

export const PRIVACY_POLICY_SECTIONS: TermsSection[] = [
  {
    id: 'data-collection',
    headingBn: '১. তথ্য সংগ্রহের ধরন',
    headingEn: '1. Types of Information Collected',
    introBn: 'আমরা ব্যবহারকারীর কাছ থেকে নিম্নোক্ত তথ্য সংগ্রহ করতে পারি:',
    introEn: 'We may collect the following information from users:',
    bulletsBn: [
      'ব্যক্তিগত তথ্য (নাম, মোবাইল নম্বর, ইমেইল ইত্যাদি)',
      'পেশাগত তথ্য (প্রতিষ্ঠানের নাম, পদবী, বেতন কাঠামো)',
      'উপস্থিতি সংক্রান্ত তথ্য (In-Time, Out-Time)',
      'ব্যবহারকারী কর্তৃক স্বেচ্ছায় প্রদত্ত অন্যান্য তথ্য',
    ],
    bulletsEn: [
      'Personal information (name, mobile number, email, etc.)',
      'Professional information (factory name, designation, salary structure)',
      'Attendance information (In-Time, Out-Time)',
      'Other information voluntarily provided by the user',
    ],
  },
  {
    id: 'data-usage',
    headingBn: '২. তথ্য ব্যবহারের উদ্দেশ্য',
    headingEn: '2. Purpose of Data Use',
    introBn: 'সংগৃহীত তথ্য ব্যবহার করা হয়:',
    introEn: 'Collected information is used for:',
    bulletsBn: [
      'সঠিক ও নির্ভুল মজুরি হিসাব প্রদান',
      'বিভিন্ন রিপোর্ট ও বিশ্লেষণ প্রদান',
      'অ্যাপসের কার্যকারিতা ও ব্যবহারকারীর অভিজ্ঞতা উন্নয়ন',
    ],
    bulletsEn: [
      'Providing accurate wage and overtime calculations',
      'Delivering salary reports and analytics',
      'Improving app functionality and user experience',
    ],
  },
  {
    id: 'data-security',
    headingBn: '৩. তথ্য সুরক্ষা ব্যবস্থা',
    headingEn: '3. Data Security Measures',
    bulletsBn: [
      'ব্যবহারকারীর তথ্য উন্নত নিরাপত্তা প্রযুক্তি ও এনক্রিপশন ব্যবস্থার মাধ্যমে সংরক্ষণ করা হয়।',
      'কোনো অনুমোদন ছাড়া তৃতীয় পক্ষের নিকট তথ্য হস্তান্তর করা হয় না, যদি না আইনগত বাধ্যবাধকতা থাকে।',
    ],
    bulletsEn: [
      'User data is stored using modern security controls and encryption.',
      'Data is never shared with third parties without authorization unless required by law.',
    ],
  },
  {
    id: 'data-sharing',
    headingBn: '৪. তথ্য শেয়ারিং নীতি',
    headingEn: '4. Data Sharing Policy',
    bulletsBn: [
      'ব্যবহারকারীর তথ্য কোনো অবস্থাতেই বিক্রয়, ভাড়া বা বাণিজ্যিকভাবে ব্যবহার করা হয় না।',
      'শুধুমাত্র প্রযোজ্য আইন অনুযায়ী প্রয়োজন হলে তথ্য প্রকাশ করা হতে পারে।',
    ],
    bulletsEn: [
      'User data is never sold, rented, or used for commercial brokerage under any circumstances.',
      'Information may only be disclosed if strictly required under applicable law.',
    ],
  },
  {
    id: 'user-rights',
    headingBn: '৫. ব্যবহারকারীর অধিকার',
    headingEn: '5. User Rights',
    introBn: 'ব্যবহারকারী:',
    introEn: 'Users have the right to:',
    bulletsBn: [
      'তার ব্যক্তিগত তথ্য হালনাগাদ করতে পারবেন',
      'প্রয়োজনে একাউন্ট মুছে ফেলার অনুরোধ করতে পারবেন',
      'নিজের তথ্য অ্যাক্সেস করার অধিকার রাখেন',
    ],
    bulletsEn: [
      'Update their personal profile and wage information',
      'Request account deletion whenever needed',
      'Access their own stored records',
    ],
  },
  {
    id: 'retention',
    headingBn: '৬. ডাটা সংরক্ষণ নীতি',
    headingEn: '6. Data Retention Policy',
    bulletsBn: [
      'ব্যবহারকারীর তথ্য অ্যাপস ব্যবহারের সময়কাল পর্যন্ত সংরক্ষিত থাকবে।',
      'একাউন্ট মুছে ফেলার পর যুক্তিসঙ্গত সময়ের মধ্যে তথ্য অপসারণ করা হতে পারে।',
    ],
    bulletsEn: [
      'User data remains stored for the duration the user actively maintains an account.',
      'Following account deletion, data may be removed within a reasonable period.',
    ],
  },
  {
    id: 'policy-updates',
    headingBn: '৭. নীতিমালার পরিবর্তন',
    headingEn: '7. Changes to Privacy Policy',
    bulletsBn: [
      'প্রয়োজনে এই গোপনীয়তা নীতি হালনাগাদ করা হতে পারে এবং তা অ্যাপে প্রকাশ করা হবে।',
    ],
    bulletsEn: [
      'This privacy policy may be updated when needed and published inside the app.',
    ],
  },
  {
    id: 'contact',
    headingBn: '৮. যোগাযোগ',
    headingEn: '8. Contact',
    introBn: 'যেকোনো প্রশ্ন, পরামর্শ বা অভিযোগের জন্য যোগাযোগ করুন:',
    introEn: 'For any questions, feedback, or complaints, contact us via:',
    bulletsBn: [
      'ইমেইল: support@shromiksathi.org',
      'সহায়তা ডেস্ক: অ্যাপের "সাপোর্ট ও মতামত" সেকশন',
    ],
    bulletsEn: [
      'Email: support@shromiksathi.org',
      'Help Desk: In-app "Support & Feedback" section',
    ],
  },
];

export const IMPORTANT_NOTICE_BULLETS_BN: string[] = [
  'একটি সহায়ক গণনামূলক প্ল্যাটফর্ম',
  'ব্যবহারকারীর প্রদত্ত তথ্যের ভিত্তিতে ফলাফল প্রদান করে',
  'কোনো আইনগত, অফিসিয়াল বা চূড়ান্ত ডকুমেন্ট হিসেবে বিবেচিত হবে না',
];

export const IMPORTANT_NOTICE_BULLETS_EN: string[] = [
  'A supportive wage calculation platform',
  'Provides outputs based on user-entered records',
  'Not considered a legal, official, or final binding document',
];

export function validateSignupTermsAcceptance(
  authMode: 'signin' | 'signup',
  acceptedTerms: boolean,
  lang: Language
): string | null {
  if (authMode === 'signup' && !acceptedTerms) {
    return lang === 'bn'
      ? 'অ্যাকাউন্ট তৈরি করতে অনুগ্রহ করে শর্তাবলী এবং গোপনীয়তা নীতিতে টিক দিয়ে সম্মতি প্রদান করুন।'
      : 'Please check the Terms & Conditions and Privacy Policy box to create an account.';
  }
  return null;
}
