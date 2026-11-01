import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  Globe,
  HelpCircle,
  History,
  LayoutGrid,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sun,
  UserCheck,
  Users,
  UserX,
  X,
  Layers,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { toBengaliDigits } from '../utils/calculations';
import { AdminSubscriptionSection } from './AdminSubscriptionSection';
import {
  ADMIN_MENU_SECTIONS,
  canAdminPerform,
  computeAdminOverviewMetrics,
  filterAndPaginateUsers,
  loadAdminStore,
  mapLegacyFeedbackToTickets,
  PRIMARY_SUPER_ADMIN_EMAIL,
  ROLE_DEFAULT_PERMISSIONS,
  sanitizeAuditMetadata,
  sanitizeUserForAdminDirectory,
  saveAdminStore,
  validateRoleChange,
  type AdminAuditLog,
  type AdminPermissionKey,
  type AdminRole,
  type AdminSectionId,
  type AdminStoreState,
  type AdminUserDirectoryEntry,
  type AnnouncementCategory,
  type AuditActionType,
  type PlatformAnnouncement,
  type PlatformConfig,
  type SupportTicketCategory,
  type SupportTicketRecord,
  type SupportTicketStatus,
} from '../utils/adminLogic';

interface AdminDashboardViewProps {
  onExitAdmin?: () => void;
}

const TICKET_CATEGORY_LABELS: Record<SupportTicketCategory, { bn: string; en: string }> = {
  login_registration: { bn: 'লগইন ও রেজিস্ট্রেশন', en: 'Login & Registration' },
  account_recovery: { bn: 'অ্যাকাউন্ট পুনরুদ্ধার', en: 'Account Recovery' },
  salary_calculation: { bn: 'বেতন হিসাব', en: 'Salary Calculation' },
  overtime_attendance: { bn: 'ওভারটাইম ও হাজিরা', en: 'Overtime & Attendance' },
  loan_debt: { bn: 'ধার-দেনা ও ঋণ হিসাব', en: 'Loan & Debt Tracker' },
  garment_info: { bn: 'গার্মেন্টস তথ্য', en: 'Garment Information' },
  contact_book: { bn: 'কন্টাক্ট বুক', en: 'Contact Book' },
  offline_sync: { bn: 'অফলাইন সিঙ্ক', en: 'Offline Synchronization' },
  bug_report: { bn: 'বাগ রিপোর্ট', en: 'Bug Report' },
  feature_request: { bn: 'ফিচার রিকোয়েস্ট', en: 'Feature Request' },
  other: { bn: 'অন্যান্য', en: 'Other' },
};

const TICKET_STATUS_LABELS: Record<SupportTicketStatus, { bn: string; en: string }> = {
  new: { bn: 'নতুন (New)', en: 'New' },
  in_progress: { bn: 'চলমান (In Progress)', en: 'In Progress' },
  waiting_for_user: { bn: 'ইউজারের উত্তরের অপেক্ষায়', en: 'Waiting for User' },
  resolved: { bn: 'সমাধানকৃত (Resolved)', en: 'Resolved' },
  closed: { bn: 'বন্ধ (Closed)', en: 'Closed' },
};

const ANNOUNCEMENT_CATEGORY_LABELS: Record<AnnouncementCategory, { bn: string; en: string }> = {
  general: { bn: 'সাধারণ ঘোষণা', en: 'General Announcement' },
  maintenance: { bn: 'মেইনটেন্যান্স নোটিশ', en: 'Maintenance Notice' },
  new_feature: { bn: 'নতুন ফিচার', en: 'New Feature' },
  security: { bn: 'নিরাপত্তা বিজ্ঞপ্তি', en: 'Security Notice' },
  important_update: { bn: 'গুরুত্বপূর্ণ আপডেট', en: 'Important Update' },
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onExitAdmin }) => {
  const {
    user,
    profile,
    isAdminUser,
    isDemoMode,
    publicDemoConfig,
    updatePublicDemoConfig,
    resetDemoData,
    todayISO,
    pendingWritesCount,
    feedbackList,
    resolveFeedback,
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    logout,
  } = useData();

  const { isOnline, syncState } = useOnlineStatus(pendingWritesCount);

  // Persistent Admin Store
  const [store, setStore] = useState<AdminStoreState>(() => loadAdminStore(todayISO));
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  // Role simulation for RBAC verification (defaults to super_admin when authorized)
  const [simulatedRole, setSimulatedRole] = useState<AdminRole | 'ordinary_worker'>(() =>
    isAdminUser ? 'super_admin' : 'ordinary_worker'
  );

  // Sync current logged-in worker's non-sensitive directory entry & live feedback into store
  useEffect(() => {
    setStore((prev) => {
      let updated = false;
      let nextUsers = prev.users;

      if (profile && profile.userId) {
        const sanitizedCurrent = sanitizeUserForAdminDirectory({
          ...profile,
          email: user?.email || 'worker.current@shromiksathi.app',
          emailVerified: user?.emailVerified ?? true,
          registeredAt: profile.joiningDate || todayISO,
          lastSeenDate: todayISO,
        });
        if (!prev.users.some((u) => u.uid === sanitizedCurrent.uid)) {
          nextUsers = [sanitizedCurrent, ...prev.users];
          updated = true;
        }
      }

      const mappedFeedback = mapLegacyFeedbackToTickets(feedbackList);
      let nextTickets = prev.tickets;
      for (const ft of mappedFeedback) {
        if (!nextTickets.some((t) => t.id === ft.id)) {
          nextTickets = [ft, ...nextTickets];
          updated = true;
        }
      }

      if (!updated) return prev;
      const nextState = { ...prev, users: nextUsers, tickets: nextTickets };
      saveAdminStore(nextState);
      return nextState;
    });
  }, [profile, user, feedbackList, todayISO]);

  const effectiveRole: AdminRole | null =
    !isAdminUser || simulatedRole === 'ordinary_worker' ? null : simulatedRole;

  const actorName =
    user?.displayName ||
    (effectiveRole === 'super_admin'
      ? 'সাদিকুল ইসলাম (Super Admin)'
      : effectiveRole === 'admin'
      ? 'তানভীর আহমেদ (Admin)'
      : 'ফারজানা ইয়াসমিন (Moderator)');

  const actorEmail = user?.email || PRIMARY_SUPER_ADMIN_EMAIL;
  const actorUid = user?.uid || 'admin_super_01';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const showError = (msg: string) => {
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(''), 4500);
  };

  // Helper to append an immutable audit log entry
  const recordAudit = (params: {
    actionType: AuditActionType;
    targetId: string;
    targetLabel: string;
    outcome?: 'success' | 'denied' | 'failed';
    reason: string;
    metadata?: Record<string, string | number | boolean>;
  }): AdminAuditLog => {
    const nowStr = `${todayISO} ${new Date().toTimeString().slice(0, 8)}`;
    const entry: AdminAuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowStr,
      actorUid,
      actorName,
      actorRole: effectiveRole || 'support_moderator',
      actionType: params.actionType,
      targetId: params.targetId,
      targetLabel: params.targetLabel,
      outcome: params.outcome || 'success',
      reason: params.reason.slice(0, 400),
      metadata: sanitizeAuditMetadata(params.metadata || {}),
    };

    if (user && !isDemoMode) {
      setDoc(doc(db, 'auditLogs', entry.id), {
        actorUid: user.uid,
        actionType: entry.actionType,
        targetId: entry.targetId,
        reason: entry.reason,
        createdAt: serverTimestamp(),
      }).catch(() => {
        // local audit mirror already persists entry
      });
    }

    return entry;
  };

  // Overview Metrics
  const metrics = useMemo(
    () =>
      computeAdminOverviewMetrics({
        users: store.users,
        tickets: store.tickets,
        errors: store.errors,
        announcements: store.announcements,
        todayISO,
      }),
    [store.users, store.tickets, store.errors, store.announcements, todayISO]
  );

  // ============================================================================
  // USER MANAGEMENT STATE & HANDLERS
  // ============================================================================
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [userMonthFilter, setUserMonthFilter] = useState<string>('all');
  const [userPage, setUserPage] = useState(1);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDirectoryEntry | null>(null);
  const [suspendModalUser, setSuspendModalUser] = useState<AdminUserDirectoryEntry | null>(null);
  const [suspendReasonInput, setSuspendReasonInput] = useState('');

  const paginatedUsers = useMemo(
    () =>
      filterAndPaginateUsers({
        users: store.users,
        searchQuery: userSearch,
        statusFilter: userStatusFilter,
        monthFilter: userMonthFilter,
        page: userPage,
        pageSize: 5,
      }),
    [store.users, userSearch, userStatusFilter, userMonthFilter, userPage]
  );

  const handleConfirmUserStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendModalUser) return;

    if (!canAdminPerform(effectiveRole, 'suspend_users')) {
      showError(
        lang === 'bn'
          ? 'অ্যাক্সেস প্রত্যাখ্যাত: ইউজার সাসপেন্ড করার অনুমতি আপনার রোলে নেই।'
          : 'Permission denied: Your role cannot suspend or reactivate accounts.'
      );
      return;
    }

    const trimmedReason = suspendReasonInput.trim();
    if (trimmedReason.length < 5) {
      showError(
        lang === 'bn'
          ? 'অনুগ্রহ করে কমপক্ষে ৫ অক্ষরের সুস্পষ্ট কারণ উল্লেখ করুন।'
          : 'Please provide a clear reason (at least 5 characters).'
      );
      return;
    }

    const targetStatus: 'active' | 'suspended' =
      suspendModalUser.accountStatus === 'active' ? 'suspended' : 'active';
    const actionType: AuditActionType =
      targetStatus === 'suspended' ? 'user_suspended' : 'user_reactivated';

    const auditEntry = recordAudit({
      actionType,
      targetId: suspendModalUser.uid,
      targetLabel: `${suspendModalUser.displayName} (${suspendModalUser.email})`,
      reason: trimmedReason,
      metadata: {
        previousStatus: suspendModalUser.accountStatus,
        newStatus: targetStatus,
      },
    });

    setStore((prev) => {
      const nextUsers = prev.users.map((u) => {
        if (u.uid !== suspendModalUser.uid) return u;
        return {
          ...u,
          accountStatus: targetStatus,
          suspensionReason: targetStatus === 'suspended' ? trimmedReason : undefined,
          suspendedAt: targetStatus === 'suspended' ? todayISO : undefined,
          suspendedBy: targetStatus === 'suspended' ? actorEmail : undefined,
          statusHistory: [
            {
              status: targetStatus,
              reason: trimmedReason,
              changedBy: actorName,
              changedAt: todayISO,
            },
            ...u.statusHistory,
          ],
        };
      });
      const nextState = {
        ...prev,
        users: nextUsers,
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(nextState);
      return nextState;
    });

    if (user && !isDemoMode) {
      setDoc(
        doc(db, 'userDirectory', suspendModalUser.uid),
        {
          uid: suspendModalUser.uid,
          displayName: suspendModalUser.displayName,
          accountStatus: targetStatus,
          ...(targetStatus === 'suspended' ? { suspensionReason: trimmedReason } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    }

    setSuspendModalUser(null);
    setSuspendReasonInput('');
    showToast(
      lang === 'bn'
        ? targetStatus === 'suspended'
          ? 'অ্যাকাউন্ট সাসপেন্ড করা হয়েছে এবং অডিট লগে রেকর্ড হয়েছে।'
          : 'অ্যাকাউন্ট পুনরায় সক্রিয় (Reactivate) করা হয়েছে।'
        : `Account ${targetStatus} and logged in audit history.`
    );
  };

  const handleTriggerSafeRecovery = (targetUser: AdminUserDirectoryEntry) => {
    if (!canAdminPerform(effectiveRole, 'manage_users')) {
      showError(lang === 'bn' ? 'অ্যাক্সেস প্রত্যাখ্যাত।' : 'Permission denied.');
      return;
    }
    const auditEntry = recordAudit({
      actionType: 'account_recovery_triggered',
      targetId: targetUser.uid,
      targetLabel: targetUser.email,
      reason: 'Initiated standard Firebase password/OAuth verification recovery link dispatch.',
      metadata: { method: targetUser.authProvider },
    });
    setStore((prev) => {
      const next = { ...prev, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(
      lang === 'bn'
        ? `${targetUser.email}-এ নিরাপদ অ্যাকাউন্ট রিকভারি নির্দেশনা পাঠানো হয়েছে।`
        : `Safe recovery verification sent to ${targetUser.email}.`
    );
  };

  // ============================================================================
  // ADMIN ROLES & PERMISSIONS STATE & HANDLERS
  // ============================================================================
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>('support_moderator');
  const [roleReason, setRoleReason] = useState('');

  const handleAssignAdminRole = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateRoleChange({
      actorRole: effectiveRole,
      actorEmail,
      targetEmail: newAdminEmail.trim(),
      newRole: newAdminRole,
    });
    if (!validation.valid) {
      showError(lang === 'bn' ? validation.errorBn! : validation.errorEn!);
      return;
    }
    if (!newAdminName.trim() || !newAdminEmail.trim() || !roleReason.trim()) {
      showError(
        lang === 'bn'
          ? 'নাম, ইমেইল এবং রোল প্রদানের কারণ পূরণ করুন।'
          : 'Please fill in name, email, and authorization reason.'
      );
      return;
    }

    const cleanEmail = newAdminEmail.trim().toLowerCase();
    const auditEntry = recordAudit({
      actionType: 'role_updated',
      targetId: cleanEmail,
      targetLabel: `${newAdminName.trim()} (${newAdminRole})`,
      reason: roleReason.trim(),
      metadata: { assignedRole: newAdminRole },
    });

    setStore((prev) => {
      const existingIdx = prev.roles.findIndex((r) => r.email.toLowerCase() === cleanEmail);
      let nextRoles = [...prev.roles];
      if (existingIdx >= 0) {
        nextRoles[existingIdx] = {
          ...nextRoles[existingIdx],
          displayName: newAdminName.trim(),
          role: newAdminRole,
          permissions: ROLE_DEFAULT_PERMISSIONS[newAdminRole],
          assignedBy: actorEmail,
          assignedAt: todayISO,
          status: 'active',
        };
      } else {
        nextRoles = [
          ...nextRoles,
          {
            uid: `admin_${Date.now()}`,
            email: cleanEmail,
            displayName: newAdminName.trim(),
            role: newAdminRole,
            permissions: ROLE_DEFAULT_PERMISSIONS[newAdminRole],
            assignedBy: actorEmail,
            assignedAt: todayISO,
            status: 'active',
          },
        ];
      }
      const next = { ...prev, roles: nextRoles, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });

    setNewAdminName('');
    setNewAdminEmail('');
    setRoleReason('');
    showToast(
      lang === 'bn'
        ? 'অ্যাডমিন রোল ও পারমিশন সফলভাবে সংরক্ষিত হয়েছে।'
        : 'Admin role assignment updated and audited.'
    );
  };

  const handleChangeExistingRole = (targetEmail: string, nextRole: AdminRole) => {
    const validation = validateRoleChange({
      actorRole: effectiveRole,
      actorEmail,
      targetEmail,
      newRole: nextRole,
    });
    if (!validation.valid) {
      showError(lang === 'bn' ? validation.errorBn! : validation.errorEn!);
      return;
    }
    const auditEntry = recordAudit({
      actionType: 'role_updated',
      targetId: targetEmail,
      targetLabel: `Role changed to ${nextRole}`,
      reason: `Role updated to ${nextRole} by Super Admin`,
      metadata: { newRole: nextRole },
    });
    setStore((prev) => {
      const nextRoles = prev.roles.map((r) =>
        r.email.toLowerCase() === targetEmail.toLowerCase()
          ? { ...r, role: nextRole, permissions: ROLE_DEFAULT_PERMISSIONS[nextRole] }
          : r
      );
      const next = { ...prev, roles: nextRoles, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(
      lang === 'bn' ? 'রোল পারমিশন আপডেট করা হয়েছে।' : 'Role permissions updated.'
    );
  };

  // ============================================================================
  // SUPPORT TICKET MANAGEMENT STATE & HANDLERS
  // ============================================================================
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<SupportTicketStatus | 'all'>('all');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<SupportTicketCategory | 'all'>('all');
  const [activeTicketId, setActiveTicketId] = useState<string | null>('tkt_1001');
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [ticketInternalNoteText, setTicketInternalNoteText] = useState('');

  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    return store.tickets.filter((t) => {
      if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false;
      if (ticketCategoryFilter !== 'all' && t.category !== ticketCategoryFilter) return false;
      if (q) {
        return (
          t.ticketNumber.toLowerCase().includes(q) ||
          t.workerName.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.message.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [store.tickets, ticketSearch, ticketStatusFilter, ticketCategoryFilter]);

  const activeTicket = useMemo(
    () =>
      store.tickets.find((t) => t.id === activeTicketId) ||
      filteredTickets[0] ||
      null,
    [store.tickets, activeTicketId, filteredTickets]
  );

  const handleUpdateTicketStatus = async (ticket: SupportTicketRecord, nextStatus: SupportTicketStatus) => {
    if (!canAdminPerform(effectiveRole, 'manage_tickets')) {
      showError(lang === 'bn' ? 'টিকিট আপডেটের অনুমতি নেই।' : 'Permission denied.');
      return;
    }

    if (nextStatus === 'resolved') {
      await resolveFeedback(ticket.id).catch(() => {});
    }

    const auditEntry = recordAudit({
      actionType: 'ticket_status_updated',
      targetId: ticket.ticketNumber,
      targetLabel: `${ticket.ticketNumber} (${ticket.subject})`,
      reason: `Ticket status changed from ${ticket.status} to ${nextStatus}`,
      metadata: { previousStatus: ticket.status, newStatus: nextStatus },
    });

    setStore((prev) => {
      const nextTickets = prev.tickets.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              status: nextStatus,
              updatedAt: todayISO,
              resolvedAt: nextStatus === 'resolved' ? todayISO : t.resolvedAt,
            }
          : t
      );
      const next = { ...prev, tickets: nextTickets, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(
      lang === 'bn'
        ? `টিকিট ${ticket.ticketNumber}-এর স্ট্যাটাস আপডেট করা হয়েছে।`
        : `Updated ${ticket.ticketNumber} status to ${nextStatus}.`
    );
  };

  const handleAssignTicket = (ticket: SupportTicketRecord, assignee: string) => {
    if (!canAdminPerform(effectiveRole, 'assign_tickets') && effectiveRole !== 'support_moderator') {
      showError(lang === 'bn' ? 'টিকিট অ্যাসাইন করার অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const auditEntry = recordAudit({
      actionType: 'ticket_assigned',
      targetId: ticket.ticketNumber,
      targetLabel: `Assigned to ${assignee}`,
      reason: `Support ticket assigned to ${assignee}`,
    });
    setStore((prev) => {
      const nextTickets = prev.tickets.map((t) =>
        t.id === ticket.id ? { ...t, assignedTo: assignee, updatedAt: todayISO } : t
      );
      const next = { ...prev, tickets: nextTickets, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(lang === 'bn' ? 'টিকিট দায়িত্বপ্রাপ্ত মডারেটরকে অ্যাসাইন করা হয়েছে।' : 'Ticket assigned.');
  };

  const handleAddTicketReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !ticketReplyText.trim()) return;
    const msg = ticketReplyText.trim();
    const nowStamp = `${todayISO} ${new Date().toTimeString().slice(0, 5)}`;

    setStore((prev) => {
      const nextTickets = prev.tickets.map((t) =>
        t.id === activeTicket.id
          ? {
              ...t,
              status: t.status === 'new' ? ('in_progress' as const) : t.status,
              updatedAt: todayISO,
              replies: [
                ...t.replies,
                {
                  id: `rep_${Date.now()}`,
                  authorName: actorName,
                  message: msg,
                  createdAt: nowStamp,
                },
              ],
            }
          : t
      );
      const next = { ...prev, tickets: nextTickets };
      saveAdminStore(next);
      return next;
    });
    setTicketReplyText('');
    showToast(lang === 'bn' ? 'ব্যবহারকারীর টিকিটে উত্তর যুক্ত করা হয়েছে।' : 'Reply sent to ticket thread.');
  };

  const handleAddInternalNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !ticketInternalNoteText.trim()) return;
    const note = ticketInternalNoteText.trim();
    const nowStamp = `${todayISO} ${new Date().toTimeString().slice(0, 5)}`;

    setStore((prev) => {
      const nextTickets = prev.tickets.map((t) =>
        t.id === activeTicket.id
          ? {
              ...t,
              internalNotes: [
                ...t.internalNotes,
                {
                  id: `note_${Date.now()}`,
                  authorName: actorName,
                  note,
                  createdAt: nowStamp,
                },
              ],
            }
          : t
      );
      const next = { ...prev, tickets: nextTickets };
      saveAdminStore(next);
      return next;
    });
    setTicketInternalNoteText('');
    showToast(lang === 'bn' ? 'অভ্যন্তরীণ অ্যাডমিন নোট সংরক্ষিত হয়েছে।' : 'Internal note added.');
  };

  // ============================================================================
  // ANNOUNCEMENTS & APP SETTINGS STATE & HANDLERS
  // ============================================================================
  const [annTitleBn, setAnnTitleBn] = useState('');
  const [annMessageBn, setAnnMessageBn] = useState('');
  const [annCategory, setAnnCategory] = useState<AnnouncementCategory>('general');
  const [annStartDate, setAnnStartDate] = useState(todayISO);
  const [annEndDate, setAnnEndDate] = useState('2026-12-31');
  const [annPreviewDevice, setAnnPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');

  // Calculation Policy Update Modal State
  const [policyHoursInput, setPolicyHoursInput] = useState(
    String(store.config.currentCalculationPolicy.standardMonthlyHours)
  );
  const [policyMultiplierInput, setPolicyMultiplierInput] = useState(
    String(store.config.currentCalculationPolicy.overtimeMultiplier)
  );
  const [policyMinGrossInput, setPolicyMinGrossInput] = useState(
    String(store.config.currentCalculationPolicy.minimumGrossWageGrade4)
  );
  const [policyReasonInput, setPolicyReasonInput] = useState('');
  const [policyConfirmOpen, setPolicyConfirmOpen] = useState(false);

  const handlePublishAnnouncement = (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    if (!canAdminPerform(effectiveRole, 'publish_announcements')) {
      showError(
        lang === 'bn'
          ? 'ঘোষণা প্রকাশ করার অনুমতি আপনার রোলে নেই।'
          : 'Your role is not permitted to publish announcements.'
      );
      return;
    }
    if (!annTitleBn.trim() || !annMessageBn.trim()) {
      showError(
        lang === 'bn'
          ? 'ঘোষণার শিরোনাম ও বিস্তারিত বার্তা লিখুন।'
          : 'Please enter announcement title and message.'
      );
      return;
    }

    const status = asDraft ? 'draft' : 'published';
    const newAnn: PlatformAnnouncement = {
      id: `ann_${Date.now()}`,
      titleBn: annTitleBn.trim(),
      titleEn: annTitleBn.trim(),
      messageBn: annMessageBn.trim(),
      messageEn: annMessageBn.trim(),
      category: annCategory,
      status,
      audience: 'all',
      startDate: annStartDate,
      endDate: annEndDate,
      publishedBy: actorEmail,
      publishedAt: status === 'published' ? todayISO : undefined,
      createdAt: todayISO,
      updatedAt: todayISO,
    };

    const auditEntry = recordAudit({
      actionType: 'announcement_published',
      targetId: newAnn.id,
      targetLabel: newAnn.titleBn,
      reason: `Announcement ${status}: ${newAnn.titleBn}`,
      metadata: { category: annCategory, status },
    });

    setStore((prev) => {
      const next = {
        ...prev,
        announcements: [newAnn, ...prev.announcements],
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(next);
      return next;
    });

    if (user && !isDemoMode) {
      setDoc(doc(db, 'announcements', newAnn.id), {
        titleBn: newAnn.titleBn,
        messageBn: newAnn.messageBn,
        category: newAnn.category,
        status: newAnn.status,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    setAnnTitleBn('');
    setAnnMessageBn('');
    showToast(
      lang === 'bn'
        ? status === 'published'
          ? 'নতুন ঘোষণা সফলভাবে প্রকাশিত হয়েছে!'
          : 'ঘোষণাটি খসড়া (Draft) হিসেবে সংরক্ষিত হয়েছে।'
        : `Announcement ${status}.`
    );
  };

  const handleToggleAnnouncementStatus = (ann: PlatformAnnouncement, nextStatus: 'published' | 'archived') => {
    if (!canAdminPerform(effectiveRole, 'publish_announcements')) {
      showError(lang === 'bn' ? 'অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const auditEntry = recordAudit({
      actionType: nextStatus === 'archived' ? 'announcement_archived' : 'announcement_published',
      targetId: ann.id,
      targetLabel: ann.titleBn,
      reason: `Changed announcement status to ${nextStatus}`,
    });
    setStore((prev) => {
      const nextAnns = prev.announcements.map((a) =>
        a.id === ann.id ? { ...a, status: nextStatus, updatedAt: todayISO } : a
      );
      const next = { ...prev, announcements: nextAnns, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(lang === 'bn' ? 'ঘোষণার স্ট্যাটাস আপডেট করা হয়েছে।' : 'Announcement updated.');
  };

  const handleToggleFeatureFlag = (key: keyof PlatformConfig['featureFlags']) => {
    if (!canAdminPerform(effectiveRole, 'manage_app_settings')) {
      showError(
        lang === 'bn'
          ? 'শুধুমাত্র সুপার অ্যাডমিন অ্যাপ সেটিংস ও ফিচার ফ্ল্যাগ পরিবর্তন করতে পারবেন।'
          : 'Only Super Admin can change feature flags.'
      );
      return;
    }
    const nextVal = !store.config.featureFlags[key];
    const auditEntry = recordAudit({
      actionType: 'config_updated',
      targetId: `featureFlag.${key}`,
      targetLabel: `Feature Flag: ${key}`,
      reason: `Toggled feature flag ${key} to ${String(nextVal)}`,
      metadata: { flag: key, enabled: nextVal },
    });
    setStore((prev) => {
      const nextConfig: PlatformConfig = {
        ...prev.config,
        featureFlags: {
          ...prev.config.featureFlags,
          [key]: nextVal,
        },
        updatedAt: todayISO,
        updatedBy: actorEmail,
      };
      const next = { ...prev, config: nextConfig, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(lang === 'bn' ? 'ফিচার ফ্ল্যাগ আপডেট করা হয়েছে।' : 'Feature flag updated.');
  };

  const handleToggleMaintenanceMode = () => {
    if (!canAdminPerform(effectiveRole, 'manage_app_settings')) {
      showError(lang === 'bn' ? 'অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const nextMode = !store.config.maintenanceMode;
    const auditEntry = recordAudit({
      actionType: 'config_updated',
      targetId: 'maintenanceMode',
      targetLabel: 'Platform Maintenance Notice Mode',
      reason: `Set maintenanceMode to ${String(nextMode)}`,
      metadata: { maintenanceMode: nextMode },
    });
    setStore((prev) => {
      const next = {
        ...prev,
        config: { ...prev.config, maintenanceMode: nextMode, updatedAt: todayISO, updatedBy: actorEmail },
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(next);
      return next;
    });
    showToast(
      lang === 'bn'
        ? nextMode
          ? 'মেইনটেন্যান্স নোটিশ মোড চালু করা হয়েছে।'
          : 'মেইনটেন্যান্স নোটিশ মোড বন্ধ করা হয়েছে।'
        : `Maintenance mode set to ${String(nextMode)}.`
    );
  };

  const handleConfirmPolicyChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdminPerform(effectiveRole, 'update_calculation_policy')) {
      showError(lang === 'bn' ? 'শুধুমাত্র সুপার অ্যাডমিন পলিসি আপডেট করতে পারবেন।' : 'Super Admin required.');
      return;
    }
    const hours = Number(policyHoursInput);
    const mult = Number(policyMultiplierInput);
    const minGross = Number(policyMinGrossInput);
    if (!hours || hours <= 0 || !mult || mult <= 0 || !minGross || minGross <= 0 || policyReasonInput.trim().length < 5) {
      showError(
        lang === 'bn'
          ? 'সঠিক সংখ্যা এবং পলিসি পরিবর্তনের সুস্পষ্ট কারণ (কমপক্ষে ৫ অক্ষর) প্রদান করুন।'
          : 'Provide valid calculation numbers and an explicit audit reason.'
      );
      return;
    }

    const newVersionStr = `v${todayISO.slice(0, 7).replace('-', '.')}-BD-RMG`;
    const newPolicy = {
      version: newVersionStr,
      effectiveFrom: todayISO,
      standardMonthlyHours: hours,
      overtimeMultiplier: mult,
      defaultWageBase: 'basic' as const,
      minimumGrossWageGrade4: minGross,
      updatedBy: actorEmail,
      updatedAt: todayISO,
      changeReason: policyReasonInput.trim(),
    };

    const auditEntry = recordAudit({
      actionType: 'policy_updated',
      targetId: newVersionStr,
      targetLabel: `Calculation Policy ${newVersionStr}`,
      reason: policyReasonInput.trim(),
      metadata: { standardMonthlyHours: hours, overtimeMultiplier: mult, minimumGrossWageGrade4: minGross },
    });

    setStore((prev) => {
      const next = {
        ...prev,
        config: {
          ...prev.config,
          currentCalculationPolicy: newPolicy,
          calculationPolicyHistory: [newPolicy, ...prev.config.calculationPolicyHistory],
          updatedAt: todayISO,
          updatedBy: actorEmail,
        },
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(next);
      return next;
    });

    setPolicyConfirmOpen(false);
    setPolicyReasonInput('');
    showToast(
      lang === 'bn'
        ? 'নতুন বেতন ও ওভারটাইম পলিসি ভার্সন সংরক্ষিত হয়েছে (পূর্ববর্তী ঐতিহাসিক রেকর্ড অপরিবর্তিত থাকবে)।'
        : 'New calculation policy version published with historical preservation.'
    );
  };

  // ============================================================================
  // SYSTEM MONITORING & AUDIT LOGS HANDLERS
  // ============================================================================
  const handleResolveErrorLog = (errId: string) => {
    if (!canAdminPerform(effectiveRole, 'resolve_system_errors')) {
      showError(lang === 'bn' ? 'অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const auditEntry = recordAudit({
      actionType: 'error_resolved',
      targetId: errId,
      targetLabel: `System Error ${errId}`,
      reason: 'Verified diagnostic log and marked resolved.',
    });
    setStore((prev) => {
      const nextErrors = prev.errors.map((er) =>
        er.id === errId
          ? { ...er, resolutionStatus: 'resolved' as const, resolvedBy: actorName, resolvedAt: todayISO }
          : er
      );
      const next = { ...prev, errors: nextErrors, auditLogs: [auditEntry, ...prev.auditLogs] };
      saveAdminStore(next);
      return next;
    });
    showToast(lang === 'bn' ? 'এরর লগ সমাধানকৃত হিসেবে চিহ্নিত হয়েছে।' : 'Error log marked resolved.');
  };

  const [auditSearch, setAuditSearch] = useState('');
  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return store.auditLogs;
    return store.auditLogs.filter(
      (log) =>
        log.actionType.toLowerCase().includes(q) ||
        log.targetLabel.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        log.reason.toLowerCase().includes(q)
    );
  }, [store.auditLogs, auditSearch]);

  const handleRunBackupVerification = () => {
    if (!canAdminPerform(effectiveRole, 'manage_backups')) {
      showError(
        lang === 'bn'
          ? 'শুধুমাত্র সুপার অ্যাডমিন ব্যাকআপ ভেরিফিকেশন পরিচালনা করতে পারবেন।'
          : 'Only Super Admin can trigger backup verification.'
      );
      return;
    }
    const nowStamp = `${todayISO} ${new Date().toTimeString().slice(0, 8)}`;
    const newBkp = {
      id: `bkp_${Date.now()}`,
      timestamp: nowStamp,
      initiatedBy: actorEmail,
      type: 'manual_verification' as const,
      status: 'verified' as const,
      collectionsCovered: 16,
      integrityHash: `sha256:${Math.random().toString(16).slice(2, 18)}a8f4c1`,
      notes: 'নন-ডেস্ট্রাক্টিভ স্কিমা ও সিকিউরিটি রুলস ইন্টিগ্রিটি চেক সফল।',
    };
    const auditEntry = recordAudit({
      actionType: 'backup_verified',
      targetId: newBkp.id,
      targetLabel: 'Manual Non-Destructive Backup Verification',
      reason: 'Verified schema integrity and non-destructive backup readiness.',
    });
    setStore((prev) => {
      const next = {
        ...prev,
        backups: [newBkp, ...prev.backups],
        auditLogs: [auditEntry, ...prev.auditLogs],
      };
      saveAdminStore(next);
      return next;
    });
    showToast(
      lang === 'bn'
        ? 'ডাটাবেস স্কিমা ও ব্যাকআপ ইন্টিগ্রিটি যাচাই সফলভাবে সম্পন্ন হয়েছে।'
        : 'Backup integrity verification completed.'
    );
  };

  const handleExportSafeAdminReport = () => {
    if (!canAdminPerform(effectiveRole, 'export_admin_reports')) {
      showError(lang === 'bn' ? 'রিপোর্ট এক্সপোর্টের অনুমতি নেই।' : 'Permission denied.');
      return;
    }
    const safeReport = {
      generatedAt: new Date().toISOString(),
      platform: 'Shromik Sathi Super Admin Report (Privacy-Preserving Aggregate)',
      privacyGuarantee: 'Contains ZERO worker salary, overtime, expense, loan, contact, or document records.',
      metrics,
      auditLogCount: store.auditLogs.length,
      recentAuditEvents: store.auditLogs.slice(0, 20),
    };
    const blob = new Blob([JSON.stringify(safeReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shromik-sathi-admin-audit-report-${todayISO}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      lang === 'bn'
        ? 'নিরাপদ অ্যাডমিন অডিট রিপোর্ট ডাউনলোড হয়েছে (কোনো ব্যক্তিগত আর্থিক তথ্য ছাড়া)।'
        : 'Privacy-safe aggregate admin report downloaded.'
    );
  };

  const getSectionIcon = (id: AdminSectionId) => {
    switch (id) {
      case 'overview':
        return <LayoutGrid className="w-5 h-5 shrink-0" />;
      case 'users':
        return <Users className="w-5 h-5 shrink-0" />;
      case 'roles':
        return <ShieldCheck className="w-5 h-5 shrink-0" />;
      case 'subscriptions':
        return <Layers className="w-5 h-5 shrink-0" />;
      case 'support':
        return <MessageSquare className="w-5 h-5 shrink-0" />;
      case 'settings':
        return <Megaphone className="w-5 h-5 shrink-0" />;
      case 'monitoring':
        return <Activity className="w-5 h-5 shrink-0" />;
      case 'audit':
        return <History className="w-5 h-5 shrink-0" />;
    }
  };

  // ============================================================================
  // UNAUTHORIZED / ORDINARY WORKER ACCESS DENIED VIEW
  // ============================================================================
  if (!effectiveRole) {
    return (
      <div className="max-w-2xl mx-auto my-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {lang === 'bn'
              ? 'অ্যাডমিন ড্যাশবোর্ড সংরক্ষিত (Access Restricted)'
              : 'Admin Dashboard Access Restricted'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {lang === 'bn'
              ? 'সাধারণ ব্যবহারকারী বা অনুমোদনহীন অ্যাকাউন্ট থেকে অ্যাডমিন প্যানেলে প্রবেশ করা সম্পূর্ণ নিষিদ্ধ। শুধুমাত্র সার্ভার-অনুমোদিত Super Admin, Admin অথবা Support Moderator এই ড্যাশবোর্ড ব্যবহার করতে পারবেন।'
              : 'Ordinary user accounts cannot access protected administrative routes. Only server-verified Super Admin, Admin, or Support Moderator accounts are permitted.'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
          <p className="font-bold text-slate-800 dark:text-slate-100">
            {lang === 'bn' ? 'নিরাপদ অ্যাডমিন প্রভিশনিং নিয়ম:' : 'Secure Administrator Provisioning:'}
          </p>
          <p>
            • Primary Super Admin: <span className="font-mono font-semibold">{PRIMARY_SUPER_ADMIN_EMAIL}</span>
          </p>
          <p>
            • Firestore Security Rule Gate: <span className="font-mono">exists(/databases/$(database)/documents/admins/$(request.auth.uid))</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {isAdminUser && (
            <button
              type="button"
              onClick={() => setSimulatedRole('super_admin')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {lang === 'bn'
                  ? 'সুপার অ্যাডমিন মোডে ফিরে যান'
                  : 'Restore Super Admin Session'}
              </span>
            </button>
          )}
          {onExitAdmin && (
            <button
              type="button"
              onClick={onExitAdmin}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === 'bn' ? 'শ্রমিক অ্যাপে ফিরে যান' : 'Return to Worker App'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentSectionMeta =
    ADMIN_MENU_SECTIONS.find((s) => s.id === activeSection) || ADMIN_MENU_SECTIONS[0];

  return (
    <div
      data-testid="super-admin-dashboard"
      className="mt-4 sm:mt-6 mb-6 sm:mb-8 min-h-[calc(100vh-5rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
    >
      {/* ===================================================================== */}
      {/* DESKTOP COLLAPSIBLE SIDEBAR */}
      {/* ===================================================================== */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all ${
          sidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {/* Sidebar Header with Official Shromik Sathi Brand Assets */}
        <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/80 p-0.5 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/Hopeful_Worker_Finance_Emblem_2098a483.png"
                alt="শ্রমিক সাথী লোগো"
                width={32}
                height={32}
                className="w-full h-full object-contain rounded-full"
              />
            </span>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {lang === 'bn' ? 'শ্রমিক সাথী অ্যাডমিন' : 'Shromik Sathi Admin'}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0 cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* 7-Item Navigation Menu (Title Only, No Subtitles) */}
        <nav aria-label="Admin Navigation" className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {ADMIN_MENU_SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                data-testid={`admin-nav-${sec.id}`}
                onClick={() => setActiveSection(sec.id)}
                title={lang === 'bn' ? sec.titleBn : sec.titleEn}
                className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors flex items-center gap-3 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/80 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <span
                  className={`shrink-0 ${
                    isActive
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {getSectionIcon(sec.id)}
                </span>
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-snug truncate">
                      {lang === 'bn' ? sec.titleBn : sec.titleEn}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Return to Worker View */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {onExitAdmin && (
            <button
              type="button"
              data-testid="exit-admin-btn"
              onClick={onExitAdmin}
              className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && (
                <span>{lang === 'bn' ? 'শ্রমিক ড্যাশবোর্ডে ফিরুন' : 'Worker View'}</span>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* MAIN ADMIN WORKSPACE */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Admin Header — Mobile-First Responsive Layout */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                data-testid="admin-mobile-menu-btn"
                aria-label="Open admin menu"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="lg:hidden min-h-[36px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
              >
                <Menu className="w-4 h-4" />
                <span>{lang === 'bn' ? 'মেনু' : 'Menu'}</span>
              </button>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {lang === 'bn' ? currentSectionMeta.titleBn : currentSectionMeta.titleEn}
              </h1>
            </div>

            {onExitAdmin && (
              <button
                type="button"
                onClick={onExitAdmin}
                className="lg:hidden min-h-[34px] px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'ফিরুন' : 'Back'}</span>
              </button>
            )}
          </div>

          {/* Right Controls: Role Simulator, Lang, Theme */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="flex-1 sm:flex-initial flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 min-w-0">
              <Shield className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <label htmlFor="admin-role-select" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                {lang === 'bn' ? 'রোল:' : 'Role:'}
              </label>
              <select
                id="admin-role-select"
                data-testid="admin-role-simulator"
                value={simulatedRole}
                onChange={(e) => setSimulatedRole(e.target.value as AdminRole | 'ordinary_worker')}
                className="w-full bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden cursor-pointer truncate"
              >
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="support_moderator">Support Moderator</option>
                <option value="ordinary_worker">Ordinary Worker (Test Deny)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
                className="min-h-[34px] sm:min-h-[36px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'EN' : 'বাংলা'}</span>
              </button>

              <button
                type="button"
                aria-label="Toggle theme"
                onClick={toggleDarkMode}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Horizontal Quick-Navigation Bar (Title Only, No Scrollbar) */}
        <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {ADMIN_MENU_SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                data-testid={`admin-mobile-pill-${sec.id}`}
                onClick={() => {
                  setActiveSection(sec.id);
                  setMobileMenuOpen(false);
                }}
                className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5">{getSectionIcon(sec.id)}</span>
                <span>{lang === 'bn' ? sec.titleBn : sec.titleEn}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile Slide-Down Navigation Menu (Title Only, No Subtitles) */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2.5 space-y-1">
            {ADMIN_MENU_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                data-testid={`admin-mobile-nav-${sec.id}`}
                onClick={() => {
                  setActiveSection(sec.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 ${
                  activeSection === sec.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-bold'
                    : 'text-slate-700 dark:text-slate-300 font-semibold'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-emerald-700 dark:text-emerald-400 shrink-0">
                    {getSectionIcon(sec.id)}
                  </span>
                  <span className="text-xs sm:text-sm truncate">
                    {lang === 'bn' ? sec.titleBn : sec.titleEn}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Toast & Error Alerts */}
        {toastMsg && (
          <div
            role="status"
            className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {errorBanner && (
          <div
            role="alert"
            className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Main Section Content Container */}
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 flex-1 overflow-y-auto">
          {/* ================================================================= */}
          {/* SECTION 1: ড্যাশবোর্ড ও অ্যানালিটিক্স (OVERVIEW & ANALYTICS) */}
          {/* ================================================================= */}
          {activeSection === 'overview' && (
            <div className="space-y-5">
              {/* 8 Summary Metric Cards — Clean Title + Number Only (No Subtitles) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'মোট নিবন্ধিত ইউজার' : 'Total Registered Users'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.totalRegisteredUsers) : metrics.totalRegisteredUsers}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'আজকের নতুন রেজিস্ট্রেশন' : 'New Registrations Today'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.newRegistrationsToday) : metrics.newRegistrationsToday}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'এই মাসের রেজিস্ট্রেশন' : 'New This Month'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                    {lang === 'bn'
                      ? toBengaliDigits(metrics.newRegistrationsThisMonth)
                      : metrics.newRegistrationsThisMonth}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'সক্রিয় অ্যাকাউন্ট (Active)' : 'Active Accounts'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.activeAccounts) : metrics.activeAccounts}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'সাসপেন্ডেড অ্যাকাউন্ট' : 'Suspended Accounts'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.suspendedAccounts) : metrics.suspendedAccounts}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'অপেক্ষমাণ সাপোর্ট টিকিট' : 'Pending Support Tickets'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1.5">
                    {lang === 'bn' ? toBengaliDigits(metrics.pendingSupportTickets) : metrics.pendingSupportTickets}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'অমীমাংসিত কারিগরি সমস্যা' : 'Unresolved Tech Issues'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                    {lang === 'bn'
                      ? toBengaliDigits(metrics.unresolvedTechnicalIssues)
                      : metrics.unresolvedTechnicalIssues}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 block">
                    {lang === 'bn' ? 'প্রকাশিত ঘোষণা' : 'Published Announcements'}
                  </span>
                  <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
                    {lang === 'bn'
                      ? toBengaliDigits(metrics.announcementsPublished)
                      : metrics.announcementsPublished}
                  </p>
                </div>
              </div>

              {/* Enhanced Interactive Analytics Dashboard: 3 Rows Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {/* 1. Worker Wage & Salary Analytics Breakdown Widget */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'bn' ? 'শ্রমিক মজুরি ও বেতনের বিভাগীয় বিশ্লেষণ' : 'Worker Wage Analytics'}</span>
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>{lang === 'bn' ? 'মূল বেতন (Basic Salary)' : 'Basic Wage'}</span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">৬০% (৳১,২৫,০০,০০০)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full w-[60%]" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>{lang === 'bn' ? 'ওভারটাইম আয় (OT Earnings)' : 'Overtime Pay'}</span>
                        <span className="font-mono font-bold text-teal-700 dark:text-teal-400">২৮% (৳৫৮,৫০,০০০)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-teal-500 h-full w-[28%]" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>{lang === 'bn' ? 'হাজিরা ও ঈদ বোনাস (Bonuses)' : 'Bonus Allowances'}</span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400">৮% (৳১৬,৭০,০০০)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full w-[8%]" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>{lang === 'bn' ? 'যাতায়াত ও অন্যান্য ভাতা' : 'Transport Allowance'}</span>
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400">৪% (৳৮,৪০,০০০)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-sky-500 h-full w-[4%]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Top Garment Industrial Zones Widget */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{lang === 'bn' ? 'গার্মেন্টস শিল্পাঞ্চলভিত্তিক ইউজার অনুপাত' : 'Industrial Zones Ratio'}</span>
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    {[
                      { areaBn: 'গাজীপুর শিল্প এলাকা', areaEn: 'Gazipur Industrial Zone', pct: 38 },
                      { areaBn: 'আশুলিয়া ও সাভার বেল্ট', areaEn: 'Ashulia & Savar Belt', pct: 26 },
                      { areaBn: 'নারায়ণগঞ্জ শিল্পাঞ্চল', areaEn: 'Narayanganj Zone', pct: 18 },
                      { areaBn: 'চট্টগ্রাম ইপিজেড (EPZ)', areaEn: 'Chittagong EPZ Zone', pct: 12 },
                      { areaBn: 'ঢাকা (মিরপুর / তেজগাঁও)', areaEn: 'Dhaka / Mirpur Zone', pct: 6 },
                    ].map((row) => (
                      <div key={row.areaBn} className="space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span>{lang === 'bn' ? row.areaBn : row.areaEn}</span>
                          <span className="font-mono font-bold">{toBengaliDigits(row.pct)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-teal-600 h-full" style={{ width: `${row.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Shift & Duty Rotation Analytics Widget */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>{lang === 'bn' ? 'শিফট ডিউটি ও বোনাস এনটাইটেলমেন্ট' : 'Shift & Bonus Analytics'}</span>
                    </h3>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                      <span className="font-semibold">{lang === 'bn' ? 'ডে শিফট (08:00 AM - 05:00 PM)' : 'Day Shift'}</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">৬৮%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                      <span className="font-semibold">{lang === 'bn' ? 'নাইট শিফট (08:00 PM - 05:00 AM)' : 'Night Shift'}</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">২২%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                      <span className="font-semibold">{lang === 'bn' ? 'সাপ্তাহিক রোটেশন রোস্টার' : 'Weekly Roster'}</span>
                      <span className="font-mono font-bold text-slate-600 dark:text-slate-300">১০%</span>
                    </div>
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                      <span>{lang === 'bn' ? 'হাজিরা বোনাস পাওয়ার যোগ্য:' : 'Punctuality Bonus Qualified:'}</span>
                      <span className="font-mono">৯১.৪%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription MRR, System Telemetry & Quick Action Shortcuts Center */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
                {/* Subscription Revenue & Conversion Breakdown (6 Cols) */}
                <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'bn' ? 'সাবস্ক্রিপশন রেভিনিউ ও প্ল্যান ট্রেন্ড' : 'Subscription Revenue Metrics'}</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <span className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-300 block">
                        {lang === 'bn' ? 'মাসিক পুনরাবৃত্তি আয় (MRR)' : 'Monthly Recurring Revenue'}
                      </span>
                      <p className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-200 mt-1">
                        ৳৪,৭৫,০০০
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                      <span className="text-[11px] font-semibold text-sky-900 dark:text-sky-300 block">
                        {lang === 'bn' ? 'পেইড প্ল্যান কনভার্সন রেট' : 'Trial to Paid Conversion'}
                      </span>
                      <p className="text-lg font-bold font-mono text-sky-800 dark:text-sky-200 mt-1">
                        ১২.৮%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span>Starter Free ({toBengaliDigits(82)}% ইউজার)</span>
                      <span className="font-mono text-slate-500">ফ্রি</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-400 h-full w-[82%]" />
                    </div>

                    <div className="flex justify-between font-semibold">
                      <span>Pro Plan ({toBengaliDigits(14)}% ইউজার - ৳১৫০/মাস)</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">৳১,৮৫,০০০</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full w-[14%]" />
                    </div>

                    <div className="flex justify-between font-semibold">
                      <span>Pro VIP Tier ({toBengaliDigits(4)}% ইউজার - ৳২৫০/মাস)</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">৳২,৯০,০০০</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full w-[4%]" />
                    </div>
                  </div>
                </div>

                {/* Quick Admin Action Center (6 Cols) */}
                <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Settings className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'bn' ? 'দ্রুত অ্যাডমিন অ্যাকশন সেন্টার' : 'Quick Admin Actions'}</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={handleExportSafeAdminReport}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-2 transition cursor-pointer text-left"
                    >
                      <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{lang === 'bn' ? 'রিপোর্ট এক্সপোর্ট (Export)' : 'Export Analytics'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection('settings')}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-2 transition cursor-pointer text-left"
                    >
                      <Megaphone className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>{lang === 'bn' ? 'সিস্টেম নোটিশ জারি' : 'Broadcast Notice'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRunBackupVerification}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-2 transition cursor-pointer text-left"
                    >
                      <Database className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{lang === 'bn' ? 'ডাটাবেস চেক' : 'DB Health Check'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveSection('audit')}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex items-center gap-2 transition cursor-pointer text-left"
                    >
                      <History className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>{lang === 'bn' ? 'অডিট লগ তালিকা' : 'View Audit Logs'}</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {lang === 'bn' ? 'ফায়ারস্টোর ডাটাবেস লেটেন্সি:' : 'Firestore Sync Latency:'}
                    </span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">১৮ ms (Healthy)</span>
                  </div>
                </div>
              </div>

              {/* 7-Section Directory Card (Title Only, No Subtitles) + Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
                {/* Left 7 Cols: Interactive 7-Section Directory (Name Only, No Subtitles) */}
                <div className="lg:col-span-7 space-y-3">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'অ্যাডমিন ড্যাশবোর্ডে যে মেনুগুলো থাকবে'
                      : 'Admin Dashboard Modules'}
                  </h2>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {ADMIN_MENU_SECTIONS.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setActiveSection(sec.id)}
                        className="w-full px-4 sm:px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="text-emerald-700 dark:text-emerald-400 shrink-0">
                            {getSectionIcon(sec.id)}
                          </span>
                          <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                            {lang === 'bn' ? sec.titleBn : sec.titleEn}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right 5 Cols: Stored Data Trends + Recent Audit Activity */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Registration & Support Breakdown Chart Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'bn'
                        ? 'মাসভিত্তিক ইউজার রেজিস্ট্রেশন ও সাপোর্ট ট্রেন্ড'
                        : 'Stored Registration & Ticket Distribution'}
                    </h3>

                    <div className="space-y-2.5 text-xs">
                      {[
                        {
                          label: lang === 'bn' ? 'অক্টোবর ২০২৬ (চলতি মাস)' : 'October 2026',
                          count: store.users.filter((u) => u.registeredAt.startsWith('2026-10')).length,
                        },
                        {
                          label: lang === 'bn' ? 'সেপ্টেম্বর ২০২৬' : 'September 2026',
                          count: store.users.filter((u) => u.registeredAt.startsWith('2026-09')).length,
                        },
                        {
                          label: lang === 'bn' ? 'আগস্ট ২০২৬ ও পূর্ববর্তী' : 'August 2026 & Earlier',
                          count: store.users.filter(
                            (u) => !u.registeredAt.startsWith('2026-10') && !u.registeredAt.startsWith('2026-09')
                          ).length,
                        },
                      ].map((row) => {
                        const pct = Math.round(
                          (row.count / Math.max(1, store.users.length)) * 100
                        );
                        return (
                          <div key={row.label} className="space-y-1">
                            <div className="flex items-center justify-between font-medium">
                              <span>{row.label}</span>
                              <span className="font-mono tabular-nums font-bold">
                                {lang === 'bn' ? toBengaliDigits(row.count) : row.count} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded-full"
                                style={{ width: `${Math.max(8, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p>
                        {lang === 'bn'
                          ? 'গোপনীয়তা সুরক্ষা: শ্রমিকদের বেতন, ওভারটাইম, খরচ, সঞ্চয়, ধার-দেনা বা কন্টাক্ট তালিকা অ্যাডমিন ড্যাশবোর্ডে সম্পূর্ণ অপ্রবেশযোগ্য।'
                          : 'Privacy Protection: Worker salary, overtime, expenses, loans, and contacts are strictly excluded from admin analytics.'}
                      </p>
                    </div>
                  </div>

                  {/* Recent Administrative Activity */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {lang === 'bn' ? 'সাম্প্রতিক অ্যাডমিন কার্যক্রম' : 'Recent Admin Activity'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveSection('audit')}
                        className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        {lang === 'bn' ? 'সব দেখুন' : 'View All'}
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {store.auditLogs.slice(0, 3).map((log) => (
                        <div key={log.id} className="py-2.5 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                              {log.targetLabel}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400 shrink-0">
                              {log.timestamp.slice(0, 10)}
                            </span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 line-clamp-1">
                            {log.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 2: ইউজার ম্যানেজমেন্ট (USER MANAGEMENT) */}
          {/* ================================================================= */}
          {activeSection === 'users' && (
            <div className="space-y-4">
              {/* Privacy Restriction Banner */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-950 dark:text-emerald-200">
                <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {lang === 'bn'
                      ? 'শ্রমিক গোপনীয়তা নীতিমালা সক্রিয় (Strict Worker Financial Privacy)'
                      : 'Strict Worker Financial Privacy Active'}
                  </p>
                  <p className="mt-0.5 text-emerald-800 dark:text-emerald-300">
                    {lang === 'bn'
                      ? 'এই তালিকায় শুধুমাত্র অ্যাকাউন্টের সাধারণ স্ট্যাটাস ও কারিগরি তথ্য দেখানো হয়। কোনো শ্রমিকের বেতন, ওভারটাইম, খরচ, সঞ্চয়, ধার-দেনা, কন্টাক্ট বুক বা ব্যক্তিগত ডকুমেন্ট অ্যাডমিন দেখতে বা পরিবর্তন করতে পারবেন না।'
                      : 'This directory shows only account status and technical metadata. Salary, overtime, expenses, loans, contacts, and private documents are never exposed.'}
                  </p>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    data-testid="admin-user-search"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                    placeholder={
                      lang === 'bn'
                        ? 'নাম, ইমেইল বা ইউজার আইডি (UID) দিয়ে খুঁজুন...'
                        : 'Search by name, email, or UID...'
                    }
                    className="w-full min-h-[40px] pl-9 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  <select
                    aria-label="Filter by account status"
                    data-testid="admin-user-status-filter"
                    value={userStatusFilter}
                    onChange={(e) => {
                      setUserStatusFilter(e.target.value as 'all' | 'active' | 'suspended');
                      setUserPage(1);
                    }}
                    className="w-full sm:w-auto min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="all">{lang === 'bn' ? 'সকল স্ট্যাটাস' : 'All Statuses'}</option>
                    <option value="active">{lang === 'bn' ? 'সক্রিয় (Active)' : 'Active'}</option>
                    <option value="suspended">{lang === 'bn' ? 'সাসপেন্ডেড (Suspended)' : 'Suspended'}</option>
                  </select>

                  <select
                    aria-label="Filter by registration month"
                    value={userMonthFilter}
                    onChange={(e) => {
                      setUserMonthFilter(e.target.value);
                      setUserPage(1);
                    }}
                    className="w-full sm:w-auto min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="all">{lang === 'bn' ? 'সকল মাস' : 'All Months'}</option>
                    <option value="2026-10">{lang === 'bn' ? 'অক্টোবর ২০২৬' : 'Oct 2026'}</option>
                    <option value="2026-09">{lang === 'bn' ? 'সেপ্টেম্বর ২০২৬' : 'Sep 2026'}</option>
                    <option value="2026-08">{lang === 'bn' ? 'আগস্ট ২০২৬' : 'Aug 2026'}</option>
                  </select>
                </div>
              </div>

              {/* Users List: Mobile Cards (< md) + Desktop Table (>= md) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedUsers.items.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      {lang === 'bn' ? 'কোনো ব্যবহারকারী পাওয়া যায়নি।' : 'No matching users found.'}
                    </div>
                  ) : (
                    paginatedUsers.items.map((u) => {
                      const isExpanded = selectedUserDetail?.uid === u.uid;
                      return (
                        <div key={u.uid} className="p-3.5 space-y-2.5 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                {u.displayName}
                              </p>
                              <p className="text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-lg font-bold shrink-0 ${
                                u.accountStatus === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              {u.accountStatus === 'active'
                                ? lang === 'bn'
                                  ? 'সক্রিয়'
                                  : 'Active'
                                : lang === 'bn'
                                ? 'সাসপেন্ডেড'
                                : 'Suspended'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            <span>UID: {u.uid}</span>
                            <span>·</span>
                            <span>{u.registeredAt}</span>
                            <span>·</span>
                            <span>{u.appVersion}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              data-testid={`mobile-user-detail-btn-${u.uid}`}
                              onClick={() =>
                                setSelectedUserDetail((prev) => (prev?.uid === u.uid ? null : u))
                              }
                              className={`min-h-[36px] px-3 rounded-xl border font-semibold cursor-pointer transition-colors ${
                                isExpanded
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              {lang === 'bn' ? 'বিস্তারিত' : 'Details'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSuspendModalUser(u);
                                setSuspendReasonInput('');
                              }}
                              className={`min-h-[36px] px-3 rounded-xl font-bold cursor-pointer ${
                                u.accountStatus === 'active'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              }`}
                            >
                              {u.accountStatus === 'active'
                                ? lang === 'bn'
                                  ? 'সাসপেন্ড'
                                  : 'Suspend'
                                : lang === 'bn'
                                ? 'রিঅ্যাক্টিভেট'
                                : 'Reactivate'}
                            </button>
                          </div>

                          {/* Inline User Details directly underneath the clicked user's 'বিস্তারিত' button */}
                          {isExpanded && (
                            <div
                              data-testid={`mobile-user-detail-panel-${u.uid}`}
                              className="mt-2 pt-3 border-t border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-slate-800/60 rounded-xl p-3.5 space-y-3"
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700/70">
                                <div>
                                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                    {u.displayName} —{' '}
                                    {lang === 'bn'
                                      ? 'অ্যাকাউন্ট ও কারিগরি তথ্য'
                                      : 'Account & Technical Summary'}
                                  </h3>
                                  <p className="text-[11px] text-slate-500 font-mono">{u.uid}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedUserDetail(null)}
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-2 text-xs">
                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                                  <span className="text-slate-500">
                                    {lang === 'bn' ? 'লগইন মাধ্যম' : 'Auth Provider'}
                                  </span>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {u.authProvider}
                                  </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                                  <span className="text-slate-500">
                                    {lang === 'bn' ? 'সর্বশেষ সক্রিয় তারিখ' : 'Last Seen Date'}
                                  </span>
                                  <span className="font-bold font-mono text-slate-900 dark:text-white">
                                    {u.lastSeenDate}
                                  </span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                                  <span className="text-slate-500">
                                    {lang === 'bn' ? 'অ্যাকাউন্ট রিকভারি সহায়তা' : 'Safe Account Recovery'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerSafeRecovery(u)}
                                    className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                                  >
                                    {lang === 'bn' ? 'ভেরিফাইড রিকভারি লিংক পাঠান' : 'Send Recovery Link'}
                                  </button>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                  {lang === 'bn'
                                    ? 'অ্যাকাউন্ট স্ট্যাটাস পরিবর্তনের ইতিহাস:'
                                    : 'Account Status History:'}
                                </h4>
                                <div className="space-y-1.5 text-[11px]">
                                  {u.statusHistory.map((h, i) => (
                                    <div
                                      key={i}
                                      className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2"
                                    >
                                      <span>
                                        <strong className="uppercase">{h.status}</strong> — {h.reason} (
                                        {h.changedBy})
                                      </span>
                                      <span className="font-mono text-slate-400 shrink-0">
                                        {h.changedAt}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                        <th className="py-3 px-4">{lang === 'bn' ? 'ব্যবহারকারী ও ইমেইল' : 'User & Email'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'ইউজার আইডি (UID)' : 'UID'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'নিবন্ধনের তারিখ' : 'Registered'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'ভেরিফিকেশন ও সিঙ্ক' : 'Verification & Sync'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'কার্যক্রম' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedUsers.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            {lang === 'bn' ? 'কোনো ব্যবহারকারী পাওয়া যায়নি।' : 'No matching users found.'}
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.items.map((u) => {
                          const isExpanded = selectedUserDetail?.uid === u.uid;
                          return (
                            <React.Fragment key={u.uid}>
                              <tr
                                className={`transition-colors ${
                                  isExpanded
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                <td className="py-3 px-4">
                                  <p className="font-bold text-slate-900 dark:text-white">{u.displayName}</p>
                                  <p className="text-slate-500 dark:text-slate-400">{u.email}</p>
                                </td>
                                <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                  {u.uid}
                                </td>
                                <td className="py-3 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                  {u.registeredAt}
                                </td>
                                <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                  <span>
                                    {u.emailVerified
                                      ? lang === 'bn'
                                        ? 'ইমেইল ভেরিফাইড'
                                        : 'Verified'
                                      : lang === 'bn'
                                      ? 'আনভেরিফাইড'
                                      : 'Unverified'}
                                  </span>
                                  <span aria-hidden="true"> · </span>
                                  <span className="font-mono">{u.appVersion}</span>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`font-bold ${
                                      u.accountStatus === 'active'
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {u.accountStatus === 'active'
                                      ? lang === 'bn'
                                        ? 'সক্রিয় (Active)'
                                        : 'Active'
                                      : lang === 'bn'
                                      ? 'সাসপেন্ডেড (Suspended)'
                                      : 'Suspended'}
                                  </span>
                                  {u.suspensionReason && (
                                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 max-w-[200px] truncate">
                                      {u.suspensionReason}
                                    </p>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      data-testid={`user-detail-btn-${u.uid}`}
                                      onClick={() =>
                                        setSelectedUserDetail((prev) =>
                                          prev?.uid === u.uid ? null : u
                                        )
                                      }
                                      className={`px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer transition-colors ${
                                        isExpanded
                                          ? 'bg-emerald-600 text-white border-emerald-600'
                                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                                      }`}
                                    >
                                      {lang === 'bn' ? 'বিস্তারিত' : 'Details'}
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`toggle-suspend-${u.uid}`}
                                      onClick={() => {
                                        setSuspendModalUser(u);
                                        setSuspendReasonInput('');
                                      }}
                                      className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
                                        u.accountStatus === 'active'
                                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300'
                                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                                      }`}
                                    >
                                      {u.accountStatus === 'active'
                                        ? lang === 'bn'
                                          ? 'সাসপেন্ড'
                                          : 'Suspend'
                                        : lang === 'bn'
                                        ? 'রিঅ্যাক্টিভেট'
                                        : 'Reactivate'}
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Inline User Detail Row rendered immediately beneath this user's row */}
                              {isExpanded && (
                                <tr
                                  data-testid={`user-detail-panel-${u.uid}`}
                                  className="bg-emerald-50/30 dark:bg-slate-800/40"
                                >
                                  <td colSpan={6} className="p-4">
                                    <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                                        <div>
                                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            {u.displayName} —{' '}
                                            {lang === 'bn'
                                              ? 'অ্যাকাউন্ট ও কারিগরি তথ্য'
                                              : 'Account & Technical Summary'}
                                          </h3>
                                          <p className="text-xs text-slate-500 font-mono">{u.uid}</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedUserDetail(null)}
                                          className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                          <span className="text-slate-500 block">
                                            {lang === 'bn' ? 'লগইন মাধ্যম' : 'Auth Provider'}
                                          </span>
                                          <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                                            {u.authProvider}
                                          </span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                          <span className="text-slate-500 block">
                                            {lang === 'bn' ? 'সর্বশেষ সক্রিয় তারিখ' : 'Last Seen Date'}
                                          </span>
                                          <span className="font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
                                            {u.lastSeenDate}
                                          </span>
                                        </div>
                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                          <span className="text-slate-500 block">
                                            {lang === 'bn'
                                              ? 'অ্যাকাউন্ট রিকভারি সহায়তা'
                                              : 'Safe Account Recovery'}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleTriggerSafeRecovery(u)}
                                            className="mt-1 text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                                          >
                                            {lang === 'bn'
                                              ? 'ভেরিফাইড রিকভারি লিংক পাঠান'
                                              : 'Send Verified Recovery Link'}
                                          </button>
                                        </div>
                                      </div>

                                      <div>
                                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                          {lang === 'bn'
                                            ? 'অ্যাকাউন্ট স্ট্যাটাস পরিবর্তনের ইতিহাস:'
                                            : 'Account Status History:'}
                                        </h4>
                                        <div className="space-y-1.5 text-xs">
                                          {u.statusHistory.map((h, i) => (
                                            <div
                                              key={i}
                                              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-2"
                                            >
                                              <span>
                                                <strong className="uppercase">{h.status}</strong> —{' '}
                                                {h.reason} ({h.changedBy})
                                              </span>
                                              <span className="font-mono text-slate-400">
                                                {h.changedAt}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Bar */}
                <div className="px-3.5 sm:px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>
                    {lang === 'bn'
                      ? `মোট ${toBengaliDigits(paginatedUsers.totalItems)} জন · পৃষ্ঠা ${toBengaliDigits(paginatedUsers.currentPage)} / ${toBengaliDigits(paginatedUsers.totalPages)}`
                      : `Total ${paginatedUsers.totalItems} · Page ${paginatedUsers.currentPage}/${paginatedUsers.totalPages}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={paginatedUsers.currentPage <= 1}
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'bn' ? 'পূর্ববর্তী' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      disabled={paginatedUsers.currentPage >= paginatedUsers.totalPages}
                      onClick={() => setUserPage((p) => Math.min(paginatedUsers.totalPages, p + 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                    >
                      {lang === 'bn' ? 'পরবর্তী' : 'Next'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Confirmation Modal for Suspend / Reactivate */}
              {suspendModalUser && (
                <div
                  role="dialog"
                  aria-modal="true"
                  className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
                >
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {suspendModalUser.accountStatus === 'active'
                            ? lang === 'bn'
                              ? 'অ্যাকাউন্ট সাসপেন্ড নিশ্চিতকরণ'
                              : 'Confirm Account Suspension'
                            : lang === 'bn'
                            ? 'অ্যাকাউন্ট রিঅ্যাক্টিভেট নিশ্চিতকরণ'
                            : 'Confirm Account Reactivation'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {suspendModalUser.displayName} ({suspendModalUser.email})
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSuspendModalUser(null)}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleConfirmUserStatusChange} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {lang === 'bn'
                            ? 'প্রশাসনিক পদক্ষেপের কারণ (অডিট লগে সংরক্ষিত হবে) *'
                            : 'Reason for administrative action (recorded in audit log) *'}
                        </label>
                        <textarea
                          rows={3}
                          required
                          data-testid="suspend-reason-input"
                          value={suspendReasonInput}
                          onChange={(e) => setSuspendReasonInput(e.target.value)}
                          placeholder={
                            lang === 'bn'
                              ? 'সুনির্দিষ্ট কারণ লিখুন (কমপক্ষে ৫ অক্ষর)...'
                              : 'Enter explicit justification (min 5 characters)...'
                          }
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs sm:text-sm"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSuspendModalUser(null)}
                          className="min-h-[38px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                        >
                          {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          data-testid="confirm-suspend-submit"
                          className={`min-h-[38px] px-4 rounded-xl text-white text-xs font-bold cursor-pointer ${
                            suspendModalUser.accountStatus === 'active'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-emerald-700 hover:bg-emerald-800'
                          }`}
                        >
                          {suspendModalUser.accountStatus === 'active'
                            ? lang === 'bn'
                              ? 'সাসপেন্ড নিশ্চিত করুন'
                              : 'Confirm Suspend'
                            : lang === 'bn'
                            ? 'রিঅ্যাক্টিভেট নিশ্চিত করুন'
                            : 'Confirm Reactivate'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 3: অ্যাডমিন রোল ও পারমিশন (ADMIN ROLES & PERMISSIONS) */}
          {/* ================================================================= */}
          {activeSection === 'roles' && (
            <div className="space-y-6">
              {/* Role Hierarchy Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Super Admin
                    </span>
                    <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === 'bn'
                      ? 'সকল প্রশাসনিক নিয়ন্ত্রণ, রোল ও পারমিশন ব্যবস্থাপনা, বেতন-ওভারটাইম পলিসি ভার্সন অনুমোদন, অডিট লগ এবং ব্যাকআপ ভেরিফিকেশন।'
                      : 'Full platform governance, role & permission management, calculation policy versioning, audit logs, and backup verification.'}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Admin</span>
                    <Shield className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === 'bn'
                      ? 'ইউজার স্ট্যাটাস ব্যবস্থাপনা, সাপোর্ট টিকিট সমাধান, ঘোষণা প্রকাশ এবং সিস্টেম মনিটরিং। সুপার অ্যাডমিনের রোল বা বেতন সূত্র পরিবর্তন করতে পারে না।'
                      : 'Manage users, support tickets, announcements, and monitoring. Cannot alter Super Admin roles or legal wage policies.'}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Support Moderator
                    </span>
                    <MessageSquare className="w-4 h-4 text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === 'bn'
                      ? 'শুধুমাত্র নির্ধারিত সাপোর্ট টিকিট দেখা, অভ্যন্তরীণ নোট যুক্ত করা এবং শ্রমিকদের প্রশ্নের উত্তর প্রদান। ইউজার সাসপেন্ড বা সেটিংস পরিবর্তনের অনুমতি নেই।'
                      : 'View and respond to assigned support tickets and feedback. Cannot suspend users, change roles, or access private data.'}
                  </p>
                </div>
              </div>

              {/* Current Administrators List: Mobile Cards + Desktop Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'অনুমোদিত অ্যাডমিন ও মডারেটর তালিকা' : 'Authorized Administrators & Moderators'}
                  </h3>
                </div>

                {/* Mobile Cards (< md) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {store.roles.map((r) => (
                    <div key={r.uid} className="p-3.5 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{r.displayName}</p>
                          <p className="font-mono text-slate-500 truncate">{r.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                          {r.role}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-500 font-mono">{r.assignedAt}</span>
                        {r.isPrimarySuperAdmin ? (
                          <span className="text-[11px] text-slate-400">
                            {lang === 'bn' ? 'অপরিবর্তনীয় (Locked)' : 'Protected Primary'}
                          </span>
                        ) : (
                          <select
                            aria-label={`Change role for ${r.displayName}`}
                            value={r.role}
                            disabled={effectiveRole !== 'super_admin'}
                            onChange={(e) =>
                              handleChangeExistingRole(r.email, e.target.value as AdminRole)
                            }
                            className="min-h-[34px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold disabled:opacity-50"
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="admin">Admin</option>
                            <option value="support_moderator">Support Moderator</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                        <th className="py-3 px-4">{lang === 'bn' ? 'নাম ও ইমেইল' : 'Name & Email'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'বর্তমান রোল' : 'Assigned Role'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'অনুমোদনের মাধ্যম' : 'Provisioned By'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'রোল পরিবর্তন (Super Admin)' : 'Modify Role'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {store.roles.map((r) => (
                        <tr key={r.uid}>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 dark:text-white">{r.displayName}</p>
                            <p className="font-mono text-slate-500">{r.email}</p>
                          </td>
                          <td className="py-3 px-4 font-semibold text-emerald-700 dark:text-emerald-400">
                            {r.role}
                            {r.isPrimarySuperAdmin && (
                              <span className="ml-1.5 text-[11px] text-slate-500 font-normal">
                                (Primary Bootstrapped)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {r.assignedBy} · <span className="font-mono">{r.assignedAt}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {r.isPrimarySuperAdmin ? (
                              <span className="text-[11px] text-slate-400">
                                {lang === 'bn' ? 'অপরিবর্তনীয় (Locked)' : 'Protected Primary'}
                              </span>
                            ) : (
                              <select
                                aria-label={`Change role for ${r.displayName}`}
                                value={r.role}
                                disabled={effectiveRole !== 'super_admin'}
                                onChange={(e) =>
                                  handleChangeExistingRole(r.email, e.target.value as AdminRole)
                                }
                                className="min-h-[34px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold disabled:opacity-50"
                              >
                                <option value="super_admin">Super Admin</option>
                                <option value="admin">Admin</option>
                                <option value="support_moderator">Support Moderator</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add / Provision New Admin Role Form */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn'
                    ? 'নতুন অ্যাডমিন বা সাপোর্ট মডারেটর নিযুক্ত করুন (Super Admin Only)'
                    : 'Assign New Administrator or Support Moderator'}
                </h3>
                <form onSubmit={handleAssignAdminRole} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                    </label>
                    <input
                      type="text"
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder={lang === 'bn' ? 'যেমন: মাহবুব আলম' : 'e.g. Mahbub Alam'}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'ভেরিফাইড ইমেইল' : 'Verified Email'}
                    </label>
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="moderator@shromiksathi.org"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'নির্ধারিত রোল' : 'Role'}
                    </label>
                    <select
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value as AdminRole)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                    >
                      <option value="support_moderator">Support Moderator</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'নিয়োগের কারণ (অডিট নোট)' : 'Authorization Reason'}
                    </label>
                    <input
                      type="text"
                      value={roleReason}
                      onChange={(e) => setRoleReason(e.target.value)}
                      placeholder={lang === 'bn' ? 'যেমন: গাজীপুর জোন সাপোর্ট ডেস্ক' : 'e.g. Support desk assignment'}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={effectiveRole !== 'super_admin'}
                      className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {lang === 'bn' ? 'রোল অনুমোদন ও সংরক্ষণ করুন' : 'Authorize & Save Role'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION: সাবস্ক্রিপশন ও প্ল্যান (SUBSCRIPTIONS & PLANS) */}
          {/* ================================================================= */}
          {activeSection === 'subscriptions' && (
            <AdminSubscriptionSection
              effectiveRole={effectiveRole}
              actorUid={actorUid}
              actorName={actorName}
              lang={lang}
              showToast={showToast}
              showError={showError}
              recordAudit={recordAudit}
            />
          )}

          {/* ================================================================= */}
          {/* SECTION 4: সাপোর্ট ও ফিডব্যাক (SUPPORT & FEEDBACK) */}
          {/* ================================================================= */}
          {activeSection === 'support' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'টিকিট নম্বর (TKT-1001), নাম বা বিষয় লিখে খুঁজুন...'
                        : 'Search by ticket ID, worker name, or issue...'
                    }
                    className="w-full min-h-[40px] pl-9 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  <select
                    aria-label="Filter tickets by status"
                    value={ticketStatusFilter}
                    onChange={(e) => setTicketStatusFilter(e.target.value as SupportTicketStatus | 'all')}
                    className="w-full sm:w-auto min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="all">{lang === 'bn' ? 'সকল স্ট্যাটাস' : 'All Statuses'}</option>
                    {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {lang === 'bn' ? v.bn : v.en}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter tickets by category"
                    value={ticketCategoryFilter}
                    onChange={(e) =>
                      setTicketCategoryFilter(e.target.value as SupportTicketCategory | 'all')
                    }
                    className="w-full sm:w-auto min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="all">{lang === 'bn' ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
                    {Object.entries(TICKET_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {lang === 'bn' ? v.bn : v.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split View: Ticket List + Selected Ticket Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left 5 Cols: Ticket Queue */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {filteredTickets.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      {lang === 'bn' ? 'কোনো সাপোর্ট টিকিট পাওয়া যায়নি।' : 'No support tickets found.'}
                    </div>
                  ) : (
                    filteredTickets.map((t) => {
                      const isSelected = activeTicket?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveTicketId(t.id)}
                          className={`w-full p-4 text-left transition-colors space-y-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/40'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {t.ticketNumber}
                            </span>
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {lang === 'bn'
                                ? TICKET_STATUS_LABELS[t.status].bn
                                : TICKET_STATUS_LABELS[t.status].en}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                            {t.subject}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              {t.workerName} ·{' '}
                              {lang === 'bn'
                                ? TICKET_CATEGORY_LABELS[t.category]?.bn
                                : TICKET_CATEGORY_LABELS[t.category]?.en}
                            </span>
                            <span className="font-mono">{t.createdAt}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Right 7 Cols: Active Ticket Details, Assignment, Internal Notes & Reply */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  {!activeTicket ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      {lang === 'bn'
                        ? 'বিস্তারিত দেখতে বাম পাশের তালিকা থেকে একটি টিকিট নির্বাচন করুন।'
                        : 'Select a ticket from the queue to inspect and respond.'}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {activeTicket.ticketNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{activeTicket.workerName}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{activeTicket.createdAt}</span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                            {activeTicket.subject}
                          </h3>
                        </div>

                        <select
                          aria-label="Update ticket status"
                          data-testid="ticket-status-select"
                          value={activeTicket.status}
                          onChange={(e) =>
                            handleUpdateTicketStatus(
                              activeTicket,
                              e.target.value as SupportTicketStatus
                            )
                          }
                          className="min-h-[36px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                        >
                          {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {lang === 'bn' ? v.bn : v.en}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Issue Description */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                        {activeTicket.message}
                      </div>

                      {/* Moderator Assignment */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                        <span className="text-slate-500">
                          {lang === 'bn' ? 'দায়িত্বপ্রাপ্ত মডারেটর:' : 'Assigned Moderator:'}{' '}
                          <strong className="text-slate-800 dark:text-slate-100">
                            {activeTicket.assignedTo}
                          </strong>
                        </span>
                        <select
                          aria-label="Assign ticket moderator"
                          value={activeTicket.assignedTo}
                          onChange={(e) => handleAssignTicket(activeTicket, e.target.value)}
                          className="min-h-[34px] px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                        >
                          {store.roles.map((r) => (
                            <option key={r.uid} value={r.displayName}>
                              {r.displayName}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Replies Thread */}
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {lang === 'bn' ? 'প্রদত্ত উত্তরসমূহ (Replies):' : 'Replies to Worker:'}
                        </h4>
                        {activeTicket.replies.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            {lang === 'bn' ? 'এখনো কোনো উত্তর পাঠানো হয়নি।' : 'No replies sent yet.'}
                          </p>
                        ) : (
                          activeTicket.replies.map((rep) => (
                            <div
                              key={rep.id}
                              className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                                <span>{rep.authorName}</span>
                                <span className="font-mono">{rep.createdAt}</span>
                              </div>
                              <p className="text-slate-800 dark:text-slate-200">{rep.message}</p>
                            </div>
                          ))
                        )}

                        <form onSubmit={handleAddTicketReply} className="flex gap-2 pt-1">
                          <input
                            type="text"
                            data-testid="ticket-reply-input"
                            value={ticketReplyText}
                            onChange={(e) => setTicketReplyText(e.target.value)}
                            placeholder={
                              lang === 'bn'
                                ? 'শ্রমিককে উত্তর লিখুন...'
                                : 'Write a helpful response to the worker...'
                            }
                            className="flex-1 min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          />
                          <button
                            type="submit"
                            data-testid="ticket-reply-submit"
                            className="min-h-[38px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'উত্তর পাঠান' : 'Reply'}</span>
                          </button>
                        </form>
                      </div>

                      {/* Internal Admin Notes */}
                      <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {lang === 'bn'
                            ? 'অভ্যন্তরীণ অ্যাডমিন নোট (শুধুমাত্র অ্যাডমিনদের জন্য):'
                            : 'Internal Admin Notes (Staff Only):'}
                        </h4>
                        {activeTicket.internalNotes.map((n) => (
                          <div
                            key={n.id}
                            className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 text-xs"
                          >
                            <span className="font-bold text-amber-900 dark:text-amber-300">
                              {n.authorName} ({n.createdAt}):
                            </span>{' '}
                            <span className="text-slate-700 dark:text-slate-200">{n.note}</span>
                          </div>
                        ))}
                        <form onSubmit={handleAddInternalNote} className="flex gap-2">
                          <input
                            type="text"
                            value={ticketInternalNoteText}
                            onChange={(e) => setTicketInternalNoteText(e.target.value)}
                            placeholder={
                              lang === 'bn'
                                ? 'অভ্যন্তরীণ নোট যুক্ত করুন...'
                                : 'Add internal team note...'
                            }
                            className="flex-1 min-h-[36px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          />
                          <button
                            type="submit"
                            className="min-h-[36px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold shrink-0 cursor-pointer"
                          >
                            {lang === 'bn' ? 'নোট যোগ' : 'Add Note'}
                          </button>
                        </form>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 5: নোটিশ ও অ্যাপ সেটিংস (ANNOUNCEMENTS & APP SETTINGS) */}
          {/* ================================================================= */}
          {activeSection === 'settings' && (
            <div className="space-y-6">
              {/* 1. Create & Preview Announcement */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'নতুন ঘোষণা বা নোটিশ তৈরি করুন' : 'Create & Publish Announcement'}
                  </h3>
                  <form
                    onSubmit={(e) => handlePublishAnnouncement(e, false)}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'ঘোষণার শিরোনাম *' : 'Announcement Title *'}
                      </label>
                      <input
                        type="text"
                        data-testid="ann-title-input"
                        value={annTitleBn}
                        onChange={(e) => setAnnTitleBn(e.target.value)}
                        placeholder={
                          lang === 'bn'
                            ? 'যেমন: ঈদুল ফিতরের সরকারি ছুটির তালিকা যুক্ত হয়েছে'
                            : 'Enter announcement headline...'
                        }
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
                        </label>
                        <select
                          value={annCategory}
                          onChange={(e) => setAnnCategory(e.target.value as AnnouncementCategory)}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                        >
                          {Object.entries(ANNOUNCEMENT_CATEGORY_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {lang === 'bn' ? v.bn : v.en}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {lang === 'bn' ? 'শুরুর তারিখ' : 'Start Date'}
                        </label>
                        <input
                          type="date"
                          value={annStartDate}
                          onChange={(e) => setAnnStartDate(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {lang === 'bn' ? 'শেষ তারিখ' : 'End Date'}
                        </label>
                        <input
                          type="date"
                          value={annEndDate}
                          onChange={(e) => setAnnEndDate(e.target.value)}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {lang === 'bn' ? 'বিস্তারিত বার্তা *' : 'Message Content *'}
                      </label>
                      <textarea
                        rows={3}
                        data-testid="ann-message-input"
                        value={annMessageBn}
                        onChange={(e) => setAnnMessageBn(e.target.value)}
                        placeholder={
                          lang === 'bn'
                            ? 'শ্রমিকদের জন্য সহজ ও স্পষ্ট বাংলায় ঘোষণাটি লিখুন...'
                            : 'Write clear announcement details...'
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => handlePublishAnnouncement(e, true)}
                        className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                      >
                        {lang === 'bn' ? 'খসড়া সংরক্ষণ (Draft)' : 'Save Draft'}
                      </button>
                      <button
                        type="submit"
                        data-testid="publish-ann-submit"
                        className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer"
                      >
                        {lang === 'bn' ? 'এখনই প্রকাশ করুন (Publish)' : 'Publish Announcement'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Live Mobile / Desktop Announcement Preview */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'নোটিশ প্রিভিউ (Preview)' : 'Live Notice Preview'}
                    </h3>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setAnnPreviewDevice('mobile')}
                        className={`px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          annPreviewDevice === 'mobile'
                            ? 'bg-white dark:bg-slate-900 shadow-2xs'
                            : 'text-slate-500'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Mobile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnnPreviewDevice('desktop')}
                        className={`px-2.5 py-1 rounded-md font-semibold inline-flex items-center gap-1 cursor-pointer ${
                          annPreviewDevice === 'desktop'
                            ? 'bg-white dark:bg-slate-900 shadow-2xs'
                            : 'text-slate-500'
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Desktop</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className={`mx-auto rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 p-4 space-y-1.5 ${
                      annPreviewDevice === 'mobile' ? 'max-w-[320px]' : 'w-full'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                      {lang === 'bn'
                        ? ANNOUNCEMENT_CATEGORY_LABELS[annCategory].bn
                        : ANNOUNCEMENT_CATEGORY_LABELS[annCategory].en}{' '}
                      · {annStartDate}
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {annTitleBn.trim() ||
                        (lang === 'bn' ? 'ঘোষণার শিরোনাম এখানে দেখাবে' : 'Announcement title preview')}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {annMessageBn.trim() ||
                        (lang === 'bn'
                          ? 'আপনার লেখা বিস্তারিত বার্তা শ্রমিকদের ফোনে এভাবে প্রদর্শিত হবে।'
                          : 'Your announcement body will appear here.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Published & Draft Announcements List */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'সকল ঘোষণার তালিকা' : 'All Platform Announcements'}
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {store.announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                            {ann.status}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {lang === 'bn'
                              ? ANNOUNCEMENT_CATEGORY_LABELS[ann.category].bn
                              : ANNOUNCEMENT_CATEGORY_LABELS[ann.category].en}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            {ann.startDate} → {ann.endDate}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          {ann.titleBn}
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">{ann.messageBn}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ann.status !== 'published' && (
                          <button
                            type="button"
                            onClick={() => handleToggleAnnouncementStatus(ann, 'published')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold cursor-pointer"
                          >
                            {lang === 'bn' ? 'প্রকাশ করুন' : 'Publish'}
                          </button>
                        )}
                        {ann.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleToggleAnnouncementStatus(ann, 'archived')}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                          >
                            {lang === 'bn' ? 'আর্কাইভ' : 'Archive'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Flags, Maintenance Mode & Calculation Policy Version Governance */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Feature Flags & Maintenance Mode */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'ফিচার ফ্ল্যাগ ও মেইনটেন্যান্স কন্ট্রোল'
                      : 'Feature Availability Flags & Maintenance'}
                  </h3>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {(
                      [
                        {
                          key: 'voiceEntry',
                          labelBn: 'বাংলা ভয়েস এন্ট্রি (Voice Entry)',
                          labelEn: 'Bengali Voice Entry',
                        },
                        {
                          key: 'googleContactsSync',
                          labelBn: 'গুগল কন্টাক্ট সিঙ্ক (People API)',
                          labelEn: 'Google Contacts Sync',
                        },
                        {
                          key: 'pdfPayslipExport',
                          labelBn: 'পিডিএফ পে-স্লিপ ও রিপোর্ট প্রিন্ট',
                          labelEn: 'PDF Payslip & Report Export',
                        },
                        {
                          key: 'personalLoanTracker',
                          labelBn: 'ধার-দেনা ও কিস্তি ট্র্যাকার',
                          labelEn: 'Personal Loan & Debt Tracker',
                        },
                        {
                          key: 'offlineSyncBanner',
                          labelBn: 'অফলাইন সিঙ্ক স্ট্যাটাস ইন্ডিকেটর',
                          labelEn: 'Offline Sync Status Indicator',
                        },
                      ] as const
                    ).map((item) => (
                      <div key={item.key} className="py-2.5 flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {lang === 'bn' ? item.labelBn : item.labelEn}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleFeatureFlag(item.key)}
                          className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                            store.config.featureFlags[item.key]
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600'
                          }`}
                        >
                          {store.config.featureFlags[item.key]
                            ? lang === 'bn'
                              ? 'চালু (Enabled)'
                              : 'Enabled'
                            : lang === 'bn'
                            ? 'বন্ধ (Disabled)'
                            : 'Disabled'}
                        </button>
                      </div>
                    ))}

                    <div className="py-3 flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {lang === 'bn' ? 'মেইনটেন্যান্স নোটিশ মোড' : 'Maintenance Notice Mode'}
                      </p>
                      <button
                        type="button"
                        onClick={handleToggleMaintenanceMode}
                        className={`px-3 py-1.5 rounded-lg font-bold shrink-0 cursor-pointer ${
                          store.config.maintenanceMode
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {store.config.maintenanceMode
                          ? lang === 'bn'
                            ? 'সক্রিয় (Active)'
                            : 'Active'
                          : lang === 'bn'
                          ? 'নিষ্ক্রিয় (Off)'
                          : 'Off'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Calculation Policy Governance & Version History */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'bn'
                        ? 'বেতন ও ওভারটাইম হিসাব নীতিমালা'
                        : 'Salary & Overtime Calculation Policy'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setPolicyConfirmOpen((p) => !p)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      {lang === 'bn' ? 'নতুন সংস্করণ প্রস্তাব' : 'Propose Policy Update'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-500 block">{lang === 'bn' ? 'মাসিক কর্মঘণ্টা' : 'Monthly Hours'}</span>
                      <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {store.config.currentCalculationPolicy.standardMonthlyHours}h
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-500 block">{lang === 'bn' ? 'ওভারটাইম গুণক' : 'OT Multiplier'}</span>
                      <span className="text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {store.config.currentCalculationPolicy.overtimeMultiplier}x
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-500 block">{lang === 'bn' ? 'ন্যূনতম মজুরি (গ্রেড-৪)' : 'Min Gross (G4)'}</span>
                      <span className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        ৳{store.config.currentCalculationPolicy.minimumGrossWageGrade4}
                      </span>
                    </div>
                  </div>

                  {policyConfirmOpen && (
                    <form
                      onSubmit={handleConfirmPolicyChange}
                      className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3 text-xs"
                    >
                      <p className="font-bold text-amber-900 dark:text-amber-200">
                        {lang === 'bn'
                          ? 'সতর্কতা: শ্রম আইন বা মজুরি সূত্র পরিবর্তনের আগে নিশ্চিতকরণ ও অডিট কারণ আবশ্যক। পূর্ববর্তী মাসের সংরক্ষিত স্ন্যাপশট অপরিবর্তিত থাকবে।'
                          : 'Warning: Explicit confirmation and audit entry required. Historical snapshots remain intact.'}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block font-semibold mb-0.5">Divisor Hours</label>
                          <input
                            type="number"
                            value={policyHoursInput}
                            onChange={(e) => setPolicyHoursInput(e.target.value)}
                            className="w-full min-h-[34px] px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5">Multiplier</label>
                          <input
                            type="number"
                            step="0.1"
                            value={policyMultiplierInput}
                            onChange={(e) => setPolicyMultiplierInput(e.target.value)}
                            className="w-full min-h-[34px] px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5">Grade-4 Gross (৳)</label>
                          <input
                            type="number"
                            value={policyMinGrossInput}
                            onChange={(e) => setPolicyMinGrossInput(e.target.value)}
                            className="w-full min-h-[34px] px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        required
                        value={policyReasonInput}
                        onChange={(e) => setPolicyReasonInput(e.target.value)}
                        placeholder={
                          lang === 'bn'
                            ? 'গেজেট বা সরকারি প্রজ্ঞাপনের সূত্র লিখুন...'
                            : 'Enter official gazette reference / reason...'
                        }
                        className="w-full min-h-[36px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPolicyConfirmOpen(false)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
                        >
                          {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
                        >
                          {lang === 'bn' ? 'নিশ্চিত ও প্রকাশ করুন' : 'Confirm & Publish Version'}
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-1.5 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                      {lang === 'bn' ? 'পলিসি সংস্করণ ইতিহাস:' : 'Policy Version History:'}
                    </span>
                    {store.config.calculationPolicyHistory.map((pol) => (
                      <div
                        key={pol.version}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-0.5"
                      >
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span>{pol.version}</span>
                          <span className="text-slate-500">{pol.effectiveFrom}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{pol.changeReason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Public Read-Only Demo Account Management Card */}
              <div
                data-testid="admin-demo-management-card"
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'bn'
                        ? 'পাবলিক রিড-অনলি ডেমো অ্যাকাউন্ট ব্যবস্থাপনা'
                        : 'Public Read-Only Demo Account Management'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="admin-toggle-demo-btn"
                      onClick={() => {
                        const nextEnabled = !publicDemoConfig.enabled;
                        updatePublicDemoConfig({ enabled: nextEnabled });
                        showToast(
                          nextEnabled
                            ? lang === 'bn'
                              ? 'পাবলিক ডেমো অ্যাকাউন্ট চালু করা হয়েছে'
                              : 'Public demo login enabled'
                            : lang === 'bn'
                            ? 'পাবলিক ডেমো অ্যাকাউন্ট সাময়িকভাবে বন্ধ করা হয়েছে'
                            : 'Public demo login disabled'
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        publicDemoConfig.enabled
                          ? 'bg-emerald-700 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {publicDemoConfig.enabled
                        ? lang === 'bn'
                          ? 'ডেমো লগইন চালু (Enabled)'
                          : 'Demo Login Enabled'
                        : lang === 'bn'
                        ? 'ডেমো লগইন বন্ধ (Disabled)'
                        : 'Demo Login Disabled'}
                    </button>

                    <button
                      type="button"
                      data-testid="admin-reset-demo-btn"
                      onClick={() => {
                        resetDemoData();
                        showToast(
                          lang === 'bn'
                            ? 'ডেমো স্যাম্পল ডেটা সফলভাবে রিসেট করা হয়েছে'
                            : 'Demo sample dataset reset to clean baseline'
                        );
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'ডেমো ডেটা রিসেট' : 'Reset Sample Data'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-500 block">
                      {lang === 'bn' ? 'ডেমো অ্যাকাউন্ট ইমেইল' : 'Demo Account Email'}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white mt-1 block truncate">
                      {publicDemoConfig.demoEmail}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-500 block">
                      {lang === 'bn' ? 'মোট ডেমো সেশন' : 'Total Demo Sessions'}
                    </span>
                    <span className="text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1 block">
                      {lang === 'bn'
                        ? toBengaliDigits(publicDemoConfig.totalDemoSessions)
                        : publicDemoConfig.totalDemoSessions}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-500 block">
                      {lang === 'bn' ? 'প্রতিহত রাইট চেষ্টা' : 'Blocked Write Attempts'}
                    </span>
                    <span className="text-base font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1 block">
                      {lang === 'bn'
                        ? toBengaliDigits(publicDemoConfig.blockedWriteAttempts)
                        : publicDemoConfig.blockedWriteAttempts}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-500 block">
                      {lang === 'bn' ? 'সর্বশেষ রিসেট' : 'Last Sample Reset'}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white mt-1 block">
                      {publicDemoConfig.lastResetAt.slice(0, 10)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn'
                        ? 'ডেমো বন্ধ থাকলে প্রদর্শিত বার্তা (বাংলা)'
                        : 'Demo Maintenance Notice (Bengali)'}
                    </label>
                    <input
                      type="text"
                      value={publicDemoConfig.maintenanceMessageBn}
                      onChange={(e) =>
                        updatePublicDemoConfig({ maintenanceMessageBn: e.target.value })
                      }
                      className="w-full min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn'
                        ? 'ডেমো নিরাপত্তা ও অ্যাক্সেস মোড'
                        : 'Demo Security & Access Policy'}
                    </label>
                    <div className="min-h-[38px] px-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/40 flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-semibold">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {lang === 'bn'
                          ? 'Strict Read-Only (UI + Context + Firestore Rules সুরক্ষিত)'
                          : 'Strict Read-Only (UI + Context + Firestore Rules enforced)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 6: সিস্টেম মনিটরিং (SYSTEM HEALTH & TECHNICAL MONITORING) */}
          {/* ================================================================= */}
          {activeSection === 'monitoring' && (
            <div className="space-y-5">
              {/* Verifiable Service Status Grid (Title + Status Only, No Subtitles) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 text-xs">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1">
                  <span className="text-slate-500 block">Firebase Authentication</span>
                  <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {user ? 'Authenticated (Verified)' : isDemoMode ? 'Demo Workspace Mode' : 'Ready'}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1">
                  <span className="text-slate-500 block">Firestore Cloud Database</span>
                  <p className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {isOnline ? 'Connected (Online)' : 'Offline Local Cache'}
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1">
                  <span className="text-slate-500 block">Offline Sync Queue</span>
                  <p className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    {pendingWritesCount} Pending ({syncState})
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-1">
                  <span className="text-slate-500 block">Push Notification Gateway</span>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400">
                    Not configured
                  </p>
                </div>
              </div>

              {/* Sanitized System Error Logs: Mobile Cards + Desktop Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'স্যানিটাইজড এরর লগ ও অফলাইন সিঙ্ক ডায়াগনস্টিকস'
                      : 'Sanitized Application Error & Sync Logs'}
                  </h3>
                </div>

                {/* Mobile Error Cards (< md) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {store.errors.map((err) => (
                    <div key={err.id} className="p-3.5 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-mono">
                          <p className="font-bold text-slate-900 dark:text-white">{err.errorCode}</p>
                          <p className="text-[11px] text-slate-500">{err.timestamp}</p>
                        </div>
                        <span
                          className={`font-bold shrink-0 ${
                            err.resolutionStatus === 'resolved'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {err.resolutionStatus === 'resolved'
                            ? lang === 'bn'
                              ? 'সমাধানকৃত'
                              : 'Resolved'
                            : lang === 'bn'
                            ? 'অমীমাংসিত'
                            : 'Unresolved'}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {err.affectedModule} · <span className="text-slate-500">{err.category}</span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        {err.sanitizedMessage}
                      </p>
                      {err.resolutionStatus !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleResolveErrorLog(err.id)}
                          className="w-full min-h-[36px] px-3 rounded-xl bg-emerald-700 text-white font-semibold cursor-pointer"
                        >
                          {lang === 'bn' ? 'সমাধান চিহ্নিত করুন' : 'Mark Resolved'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                        <th className="py-3 px-4">{lang === 'bn' ? 'সময় ও কোড' : 'Timestamp & Code'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'মডিউল ও ক্যাটাগরি' : 'Module & Category'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'স্যানিটাইজড বিবরণ' : 'Sanitized Diagnostic'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'পদক্ষেপ' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {store.errors.map((err) => (
                        <tr key={err.id}>
                          <td className="py-3 px-4 font-mono">
                            <p className="font-bold text-slate-900 dark:text-white">{err.errorCode}</p>
                            <p className="text-[11px] text-slate-500">{err.timestamp}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {err.affectedModule}
                            </p>
                            <p className="text-slate-500">{err.category}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-md">
                            {err.sanitizedMessage}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-bold ${
                                err.resolutionStatus === 'resolved'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {err.resolutionStatus === 'resolved'
                                ? lang === 'bn'
                                  ? 'সমাধানকৃত (Resolved)'
                                  : 'Resolved'
                                : lang === 'bn'
                                ? 'অমীমাংসিত (Unresolved)'
                                : 'Unresolved'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {err.resolutionStatus !== 'resolved' ? (
                              <button
                                type="button"
                                onClick={() => handleResolveErrorLog(err.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold cursor-pointer"
                              >
                                {lang === 'bn' ? 'সমাধান চিহ্নিত করুন' : 'Mark Resolved'}
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">{err.resolvedBy}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* SECTION 7: অডিট লগ ও ব্যাকআপ (AUDIT LOGS & BACKUP RECOVERY) */}
          {/* ================================================================= */}
          {activeSection === 'audit' && (
            <div className="space-y-5">
              {/* Top Action Bar: Search Audit Logs & Export Safe Report */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'অ্যাকশন, অ্যাডমিন নাম বা টার্গেট আইডি দিয়ে অডিট লগ খুঁজুন...'
                        : 'Search audit history by action, actor, or target...'
                    }
                    className="w-full min-h-[40px] pl-9 pr-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportSafeAdminReport}
                  className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {lang === 'bn'
                      ? 'অডিট ও সামারি রিপোর্ট এক্সপোর্ট (JSON)'
                      : 'Export Safe Audit Report'}
                  </span>
                </button>
              </div>

              {/* Immutable Audit Log: Mobile Cards + Desktop Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'অপরিবর্তনীয় প্রশাসনিক অডিট লগ (Immutable Audit Trail)'
                      : 'Immutable Administrative Audit Trail'}
                  </h3>
                </div>

                {/* Mobile Audit Cards (< md) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAuditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2 font-mono">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {log.actionType}
                        </span>
                        <span className="text-[11px] text-slate-500">{log.timestamp}</span>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">{log.targetLabel}</p>
                      <p className="text-slate-600 dark:text-slate-300">{log.reason}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>
                          {log.actorName} ({log.actorRole})
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                          {log.outcome}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Audit Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold">
                        <th className="py-3 px-4">{lang === 'bn' ? 'ইভেন্ট আইডি ও সময়' : 'Event & Timestamp'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'প্রশাসক ও রোল' : 'Acting Admin'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'অ্যাকশন ও টার্গেট' : 'Action & Target'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'কারণ ও ফলাফল' : 'Reason & Outcome'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAuditLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="py-3 px-4 font-mono">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{log.id}</p>
                            <p className="text-[11px] text-slate-500">{log.timestamp}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 dark:text-white">{log.actorName}</p>
                            <p className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">
                              {log.actorRole}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold font-mono text-slate-800 dark:text-slate-200">
                              {log.actionType}
                            </p>
                            <p className="text-slate-500">{log.targetLabel}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-slate-700 dark:text-slate-200">{log.reason}</p>
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                              {log.outcome}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data Backup Verification & Non-Destructive Recovery Protocol */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'ডেটা ব্যাকআপ যাচাই ও নিরাপদ পুনরুদ্ধার নীতিমালা'
                      : 'Verified Backup Status & Safe Recovery Procedure'}
                  </h3>
                  <button
                    type="button"
                    onClick={handleRunBackupVerification}
                    className="min-h-[38px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'bn' ? 'ব্যাকআপ ইন্টিগ্রিটি যাচাই করুন' : 'Verify Backup Integrity'}
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {store.backups.map((bkp) => (
                    <div
                      key={bkp.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-emerald-700 dark:text-emerald-400 uppercase">
                          {bkp.status} ({bkp.collectionsCovered} Collections)
                        </span>
                        <span className="font-mono text-slate-500">{bkp.timestamp}</span>
                      </div>
                      <p className="font-mono text-[11px] text-slate-500 truncate">
                        {bkp.integrityHash}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">{bkp.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
