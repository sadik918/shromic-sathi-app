# Technical Guide: Firestore-Backed Bidirectional Synchronization Architecture

This document provides a comprehensive technical guide explaining the bidirectional data synchronization mechanism between the **Shromik Sathi Web PWA** (React / TypeScript / Vite) and the **Android Kotlin App** (WebView / Native Bridge / Firebase SDK).

---

## 1. Executive Summary & Shared Configuration

Both the Web PWA and the Android Kotlin app share a single, unified Google Cloud Firebase project and custom Firestore database instance. All user data—including worker profile, overtime records, monthly salary slips, payment transactions, daily attendance, expenses, personal loans, alarms, and document vaults—are synchronized in real time across devices.

### Critical Verification Parameters

To ensure bidirectional synchronization works seamlessly, both platforms MUST target the exact same Cloud Project and Firestore Database ID:

| Parameter | Configuration Value |
|---|---|
| **Firebase Project ID** | `gen-lang-client-0524311670` |
| **Firestore Database ID** | `ai-studio-bcf4f937-8686-4b7f-8375-af9589cd1cf0` |
| **Web Client App ID** | `1:662565207183:web:365eb17d14188fbd8e84fa` |
| **Auth Domain** | `gen-lang-client-0524311670.firebaseapp.com` |
| **OAuth Client ID** | `662565207183-dgh4hgjbhf3gdehvc3p83povkissud3s.apps.googleusercontent.com` |

---

## 2. Web PWA Client Initialization (`src/firebase.ts`)

In the React / TypeScript Web app, Firestore is initialized with persistent local caching and multi-tab state management using the explicit database ID:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = firebaseConfig.firestoreDatabaseId || 'ai-studio-bcf4f937-8686-4b7f-8375-af9589cd1cf0';

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
}, dbId);

export const auth = getAuth(app);
```

---

## 3. Android Kotlin Integration & Verification

For the Android application, you can connect using either of the following patterns:

### Option A: WebView Native Bridge Integration (Recommended)
If your Android app embeds the Web PWA inside a `WebView`, ensure the WebView loads the live app URL:
```kotlin
val webView: WebView = findViewById(R.id.webview)
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true
webView.loadUrl("https://ais-pre-fq3f7edpt2rlmj23ujkcch-759429489088.asia-southeast1.run.app")
```

### Option B: Native Firebase SDK Initialization (Kotlin)
If writing native Kotlin screens alongside WebView, initialize Firebase Firestore using the named database ID:

```kotlin
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings

// Initialize Firebase App
FirebaseApp.initializeApp(context)

// Acquire specific Firestore instance by Database ID
val db = FirebaseFirestore.getInstance("ai-studio-bcf4f937-8686-4b7f-8375-af9589cd1cf0")

// Enable persistent disk cache for offline access
val settings = FirebaseFirestoreSettings.Builder()
    .setPersistenceEnabled(true)
    .build()
db.firestoreSettings = settings
```

---

## 4. Firestore Data Schema & Isolation Hierarchy

All user documents are isolated strictly by the authenticated user's Firebase UID (`request.auth.uid == userId`):

```
/users/{userId}                              <-- Parent WorkerProfile Document
    ├── /overtime/{date}                      <-- Daily Overtime Records
    ├── /salaryRecords/{month}                <-- Monthly Salary Slips & Formulas
    ├── /payments/{paymentId}                 <-- Salary Advances & Payments Received
    ├── /attendance/{date}                    <-- Daily Attendance & Shift Logs
    ├── /expenses/{expenseId}                 <-- Daily Personal & Rent Expenses
    ├── /savings/{goalId}                     <-- Savings Deposits & Goals
    ├── /documents/{docId}                    <-- Private Vault Documents (PDF/Images)
    ├── /reminders/{reminderId}               <-- Alarms & Calendar Reminders
    ├── /loans/{loanId}                       <-- Personal Loans (Lent & Borrowed)
    ├── /workplaces/{workplaceId}             <-- Garment Career History
    └── /contacts/{contactId}                 <-- Garment Contact Directory
```

---

## 5. Bidirectional Real-Time Listener Architecture (`src/context/DataContext.tsx`)

Data synchronization occurs continuously through Firestore `onSnapshot` subscriptions.

### Parent Profile & Subcollection Listeners
When a user logs in, 11 subcollection query listeners are spawned simultaneously:

```typescript
const subCollections = [
  'overtime', 'salaryRecords', 'payments', 'attendance', 
  'expenses', 'savings', 'documents', 'reminders', 
  'loans', 'workplaces', 'contacts'
];

subCollections.forEach((colName) => {
  const colRef = collection(db, 'users', uid, colName);
  const q = query(colRef, where('userId', '==', uid));
  onSnapshot(q, (snapshot) => {
    const remoteItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Reconcile with local offline mutation queue & update React state
  });
});
```

---

## 6. Offline Queue & Conflict Reconciliation Engine

When a device is offline, mutations are queued locally in `localStorage` under `shromik_sathi_offline_queue_${userId}`.

### Reconciliation Rules (`src/utils/offlineSync.ts`)
1. **Local Precedence during active edits:** Items modified locally while offline are preserved until successfully written to Firestore.
2. **Server Authority on snapshot update:** Remote changes are merged into the local state mirror (`saveUserMirror`).
3. **Automatic Flush:** Background synchronization triggers automatically upon:
   - Connection recovery (`window.addEventListener('online', ...)`)
   - Window/App focus (`window.addEventListener('focus', ...)`)
   - Tab visibility change (`document.addEventListener('visibilitychange', ...)`)

---

## 7. How to Verify Active Sync Between Web & Android

Follow these steps to test and verify real-time synchronization:

1. **Open Web App:** Navigate to the Web app on a PC or browser and log in with your account (e.g. `user@example.com`).
2. **Open Android App:** Open the Android app on your mobile phone and sign in with the **exact same account**.
3. **Add an Entry on Web:** Go to "ওভারটাইম" (Overtime) or "হাজিরা" (Attendance) on the Web and enter 2 hours of overtime.
4. **Observe Android App:** Check your Android phone; within 1 second, the updated overtime hours and total salary will reflect automatically on the phone screen without manual refresh.
5. **Test Offline Sync:** Turn off Wi-Fi/Mobile Data on the phone, add a daily expense (e.g. ৳ 200 for market purchase), then re-enable internet. The record will flush automatically to Cloud Firestore and display on the Web app instantly.

---

## 8. Summary Checklist

- [x] Shared Firebase Project ID: `gen-lang-client-0524311670`
- [x] Shared Firestore Database ID: `ai-studio-bcf4f937-8686-4b7f-8375-af9589cd1cf0`
- [x] Granular security rules enforcing user data privacy (`firestore.rules`)
- [x] Automatic real-time background sync on `online`, `focus`, and `visibilitychange`
- [x] Full offline persistence with queue reconciliation
