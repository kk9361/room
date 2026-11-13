"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  PieChart,
  Bell,
  Settings,
  ShieldCheck,
  Plus,
  ChevronDown,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  LogOut,
  Menu,
  X,
  ArrowRight,
  Users,
  LockKeyhole,
  ReceiptText,
  Check,
  RefreshCw,
  MoreHorizontal,
  CalendarDays,
} from "lucide-react";
import {
  api,
  post,
  patch,
  refreshSession,
  setToken,
  money,
  today,
} from "@/lib/api";
import type {
  User,
  Room,
  Member,
  Category,
  Expense,
  Balance,
  Settlement,
  Transfer,
  Announcement,
  Report,
  Page,
} from "@/lib/types";
import { Auth } from "./auth";
import { Modal, Empty, FormError, Spinner } from "./ui";
import { ExpenseForm, PasswordForm, SimpleForm, SettlementForm } from "./forms";
import { Reports } from "./reports";
import { Admin } from "./admin";

const nav = [
  { name: "Overview", path: "/dashboard", icon: LayoutDashboard },
  { name: "Shared expenses", path: "/expenses", icon: ReceiptText },
  { name: "Balances & settle up", path: "/balances", icon: ArrowLeftRight },
  { name: "My personal expenses", path: "/personal/expenses", icon: Wallet },
  { name: "Reports", path: "/reports", icon: PieChart },
  { name: "Announcements", path: "/announcements", icon: Bell },
  { name: "Rooms & members", path: "/rooms", icon: Users },
  { name: "Settings", path: "/settings", icon: Settings },
];
type Dialog = {
  kind: string;
  expense?: Expense;
  transfer?: Transfer;
  settlement?: Settlement;
  action?: string;
  announcement?: Announcement;
} | null;
export function LedgerApp() {
  const path = usePathname(),
    router = useRouter();
  const section = path.startsWith("/personal")
    ? "/personal/expenses"
    : path.startsWith("/admin")
      ? "/admin"
      : nav.find((n) => path.startsWith(n.path))?.path ||
        (path.includes("/balances") || path.includes("/settlements")
          ? "/balances"
          : path.includes("/reports")
            ? "/reports"
            : path.includes("/expenses")
              ? "/expenses"
              : "/dashboard");
  const [user, setUser] = useState<User | null>(null),
    [checking, setChecking] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]),
    [roomId, setRoomId] = useState(""),
    [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]),
    [personalCategories, setPersonalCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Page<Expense>>({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    }),
    [personal, setPersonal] = useState<Page<Expense>>({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    });
  const [balances, setBalances] = useState<Balance[]>([]),
    [suggestions, setSuggestions] = useState<Transfer[]>([]),
    [settlements, setSettlements] = useState<Page<Settlement>>({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    });
  const [announcements, setAnnouncements] = useState<Page<Announcement>>({
      items: [],
      page: 1,
      page_size: 20,
      total: 0,
    }),
    [monthly, setMonthly] = useState<Report | null>(null);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<Announcement[]>([]),
    [notificationCount, setNotificationCount] = useState(0),
    [notificationOpen, setNotificationOpen] = useState(false),
    [announcementPopup, setAnnouncementPopup] = useState<Announcement | null>(null);
  const seenAnnouncementIds = useRef(new Map<string, Set<string>>()),
    loadedNotificationRooms = useRef(new Set<string>());
  const [dialog, setDialog] = useState<Dialog>(null),
    [sideOpen, setSideOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [categoryFilter, setCategoryFilter] = useState("");
  const [reload, setReload] = useState(0),
    [inviteToken, setInviteToken] = useState("");
  const room = rooms.find((r) => r.id === roomId);
  const membership = room?.members.find(
    (m) => m.user_id === user?.id && m.status === "active",
  );
  const isAdmin = membership?.role === "room_admin",
    archived = room?.status === "archived";
  const close = useCallback(() => {
    setDialog(null);
    setInviteToken("");
  }, []);
  const notify = useCallback((message: string) => setNotice(message), []);
  const person = (id: string) =>
    members.find((m) => m.user_id === id)?.display_name ||
    (id === user?.id ? user.display_name : "Former member");
  useEffect(() => {
    let live = true;
    (async () => {
      if (await refreshSession()) {
        try {
          const data = await api<User>("/auth/me");
          if (live) setUser(data);
        } catch {
          /* Login remains available. */
        }
      }
      if (live) setChecking(false);
    })();
    const expired = () => {
      setUser(null);
      setToken(null);
      setNotice("Your session ended. Please sign in again.");
    };
    window.addEventListener("session-expired", expired);
    return () => {
      live = false;
      window.removeEventListener("session-expired", expired);
    };
  }, []);
  useEffect(() => {
    setPage(1);
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setCategoryFilter("");
    setSideOpen(false);
  }, [section, roomId]);
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(id);
    }
  }, [notice]);
  useEffect(() => {
    if (!user || user.must_change_password) return;
    let live = true;
    api<Page<Room>>("/rooms?page_size=100")
      .then((data) => {
        if (live) {
          setRooms(data.items);
          setRoomId((current) =>
            data.items.some((r) => r.id === current)
              ? current
              : data.items[0]?.id || "",
          );
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [user, reload]);
  useEffect(() => {
    if (!user || user.must_change_password) return;
    let live = true;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), page_size: "20" });
    if (search) query.set("search", search);
    if (dateFrom) query.set("from", dateFrom);
    if (dateTo) query.set("to", dateTo);
    if (categoryFilter) query.set("category_id", categoryFilter);
    const root = `/rooms/${roomId}`,
      month = today(room?.timezone).slice(0, 7).split("-");
    const personalQuery =
      section === "/personal/expenses"
        ? query
        : new URLSearchParams({ page_size: "20" });
    async function load() {
      const [privateExpenses, privateCategories, shared] = await Promise.all([
        api<Page<Expense>>(`/personal/expenses?${personalQuery}`),
        api<Page<Category>>("/personal/categories"),
        roomId ? Promise.all([
          api<{ items: Member[] }>(root + "/members"),
          api<Page<Category>>(root + "/categories"),
          api<Page<Expense>>(`${root}/expenses?${section === "/expenses" ? query : "page_size=20"}`),
          api<{ items: Balance[] }>(root + "/balances"),
          api<{ items: Transfer[] }>(root + "/settlements/suggestions"),
          api<Page<Settlement>>(`${root}/settlements?page=${section === "/balances" ? page : 1}`),
          api<Page<Announcement>>(`${root}/announcements?page=${section === "/announcements" ? page : 1}`),
          api<Report>(`${root}/reports/monthly?year=${month[0]}&month=${month[1]}`),
        ]) : null,
      ]);
      if (!live) return;
      setPersonal(privateExpenses);
      setPersonalCategories(privateCategories.items);
      if (shared) {
        setMembers(shared[0].items);
        setCategories(shared[1].items);
        setExpenses(shared[2]);
        setBalances(shared[3].items);
        setSuggestions(shared[4].items);
        setSettlements(shared[5]);
        setAnnouncements(shared[6]);
        setMonthly(shared[7]);
      } else {
        setMembers([]);
        setCategories([]);
        setExpenses({ items: [], page: 1, page_size: 20, total: 0 });
        setBalances([]);
        setMonthly(null);
      }
    }
    load().catch((e: Error) => live && setError(e.message)).finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [
    user,
    roomId,
    room?.timezone,
    page,
    search,
    dateFrom,
    dateTo,
    categoryFilter,
    reload,
    section,
  ]);
  useEffect(() => {
    setUnreadAnnouncements([]);
    setNotificationCount(0);
    setAnnouncementPopup(null);
    setNotificationOpen(false);
    if (!user || user.must_change_password || !roomId) return;
    const notificationKey = `${user.id}:${roomId}`;
    let live = true;
    let pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await api<{ items: Announcement[]; total: number }>(
          `/rooms/${roomId}/announcements/unread`,
        );
        if (!live) return;
        setUnreadAnnouncements(result.items);
        setNotificationCount(result.total);
        const seen = seenAnnouncementIds.current.get(notificationKey) || new Set<string>();
        seenAnnouncementIds.current.set(notificationKey, seen);
        if (!loadedNotificationRooms.current.has(notificationKey)) {
          loadedNotificationRooms.current.add(notificationKey);
          result.items.forEach((item) => seen.add(item.id));
          if (result.items[0]) setAnnouncementPopup(result.items[0]);
        } else {
          const fresh = result.items.filter((item) => !seen.has(item.id));
          fresh.forEach((item) => seen.add(item.id));
          if (fresh[0]) setAnnouncementPopup(fresh[0]);
        }
      } catch {
        // Notifications can retry on the next poll without blocking the ledger.
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 10000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [user?.id, user?.must_change_password, roomId]);
  async function done(message = "Saved successfully.") {
    setDialog(null);
    setInviteToken("");
    setReload((v) => v + 1);
    notify(message);
  }
  async function markAnnouncementsRead(ids: string[]) {
    if (!roomId || !ids.length) return;
    try {
      const result = await post<{ marked_read: number }>(
        `/rooms/${roomId}/announcements/read`,
        { announcement_ids: ids },
      );
      const readIds = new Set(ids);
      setUnreadAnnouncements((items) => items.filter((item) => !readIds.has(item.id)));
      setNotificationCount((count) => Math.max(0, count - result.marked_read));
      setAnnouncementPopup((item) => item && readIds.has(item.id) ? null : item);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function viewAnnouncement(item: Announcement) {
    await markAnnouncementsRead([item.id]);
    setNotificationOpen(false);
    setReload((value) => value + 1);
    router.push("/announcements");
  }
  const my = balances.find((b) => b.user_id === user?.id),
    myMonth = monthly?.member_totals?.find((b) => b.user_id === user?.id);
  const topCategories = [...(monthly?.by_category || [])]
    .filter((item) => item.amount_paise > 0)
    .sort((a, b) => b.amount_paise - a.amount_paise)
    .slice(0, 4);
  const largestCategory = topCategories[0]?.amount_paise || 1;
  const title =
    section === "/admin"
      ? "Platform administration"
      : nav.find((n) => n.path === section)?.name || "Overview";
  const personalView = section === "/personal/expenses";
  const expenseModal = () =>
    setDialog({ kind: personalView ? "personal" : "expense" });
  if (!user)
    return (
      <Auth
        checking={checking}
        done={(u) => {
          setUser(u);
          router.push("/dashboard");
        }}
      />
    );
  if (user.must_change_password)
    return (
      <div className="password-gate">
        <div className="panel">
          <span className="brand-icon">
            <ShieldCheck />
          </span>
          <h1>Secure your account.</h1>
          <p className="muted">
            Replace your temporary administrator password before opening your
            ledger.
          </p>
          <PasswordForm
            done={(u) => {
              setUser(u);
              notify("Password changed. Your account is ready.");
            }}
          />
        </div>
      </div>
    );
  const noRoom = (
    <Empty
      title="A shared home starts here."
      detail="Create your household or accept an invitation to start keeping expenses together."
      action={
        <div className="button-row">
          <button
            className="button primary"
            onClick={() => setDialog({ kind: "room" })}
          >
            <Plus size={17} />
            Create a room
          </button>
          <button
            className="button secondary"
            onClick={() => setDialog({ kind: "accept" })}
          >
            Join with invitation
          </button>
        </div>
      }
    />
  );
  function pagination(total: number) {
    return (
      <div className="pagination">
        <span>{total} records</span>
        <button disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button
          disabled={page * 20 >= total}
          onClick={() => setPage((v) => v + 1)}
        >
          Next
        </button>
      </div>
    );
  }
  function expenseTable(items: Expense[], privateView = false) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Expense</th>
              <th>Date</th>
              {!privateView && <th>Paid by</th>}
              <th>Category</th>
              <th className="right">Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr
                key={x.id}
                className={x.status === "reversed" ? "reversed" : ""}
              >
                <td>
                  <div className="expense-cell">
                    <span
                      className={`expense-icon ${privateView ? "purple" : ""}`}
                    >
                      <ReceiptText size={18} />
                    </span>
                    <div>
                      <strong>{x.description}</strong>
                      <small>
                        {privateView
                          ? "Private · only you"
                          : x.status === "reversed"
                            ? "Reversed"
                            : `${x.splits?.length} people · ${x.split_type} split`}
                      </small>
                    </div>
                  </div>
                </td>
                <td className="nowrap">
                  {new Date(x.expense_date + "T00:00:00").toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short" },
                  )}
                </td>
                {!privateView && (
                  <td>
                    <div className="member-name">
                      <span className="avatar tiny">
                        {person(x.paid_by)[0]}
                      </span>
                      {x.paid_by === user!.id ? "You" : person(x.paid_by)}
                    </div>
                  </td>
                )}
                <td>
                  <span className="category-pill">
                    {(privateView ? personalCategories : categories).find(
                      (c) => c.id === x.category_id,
                    )?.name || "Uncategorized"}
                  </span>
                </td>
                <td className="amount right">
                  {money(privateView ? x.amount_paise! : x.total_paise)}
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${x.description}`}
                    onClick={() =>
                      setDialog({
                        kind: privateView ? "personalDetail" : "detail",
                        expense: x,
                      })
                    }
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="app-layout">
      <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
        <Link href="/dashboard" className="brand">
          <span className="brand-icon">
            <House size={22} />
          </span>
          <span>
            RoomMate<small>LEDGER</small>
          </span>
        </Link>
        <button
          className="icon-button sidebar-close"
          aria-label="Close navigation"
          onClick={() => setSideOpen(false)}
        >
          <X />
        </button>
        <div className="room-switch">
          <span className="eyebrow">YOUR HOUSEHOLD</span>
          <div>
            <span className="room-symbol">
              <House size={18} />
            </span>
            <label className="sr-only" htmlFor="room-picker">
              Current room
            </label>
            <select
              id="room-picker"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              {!rooms.length && <option value="">Choose your room</option>}
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.status === "archived" ? " (archived)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
        <nav aria-label="Main navigation">
          <span className="nav-caption">WORKSPACE</span>
          {nav.map((n) => (
            <Link
              key={n.path}
              href={n.path}
              className={`nav-link ${section === n.path ? "active" : ""}`}
              aria-current={section === n.path ? "page" : undefined}
            >
              <n.icon size={19} />
              {n.name}
              {n.path === "/personal/expenses" && (
                <LockKeyhole className="nav-lock" size={12} />
              )}
            </Link>
          ))}
          {user.platform_role === "super_admin" && (
            <Link
              className={`nav-link ${section === "/admin" ? "active" : ""}`}
              href="/admin"
            >
              <ShieldCheck size={19} />
              Platform admin
            </Link>
          )}
        </nav>
        <div className="sidebar-tip">
          <span className="tip-icon">
            <Users size={22} />
          </span>
          <h4>Better, together.</h4>
          <p>Clear expenses make room for the good stuff.</p>
          <button
            onClick={() => setDialog({ kind: isAdmin ? "invite" : "accept" })}
          >
            {isAdmin ? "Invite a roommate" : "Join another room"}
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="sidebar-profile">
          <span className="avatar">{user.display_name[0]}</span>
          <div>
            <strong>{user.display_name}</strong>
            <small>{isAdmin ? "Room administrator" : "Room member"}</small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={async () => {
              try {
                await post("/auth/logout", {});
              } catch (e) {
                setError((e as Error).message);
                return;
              }
              setToken(null);
              setUser(null);
              setRooms([]);
              setRoomId("");
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {sideOpen && (
        <div className="sidebar-scrim" onClick={() => setSideOpen(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSideOpen(true)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <b>{title}</b>
          </div>
          <div className="topbar-right">
            <span className="today">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: room?.timezone || "Asia/Kolkata",
              })}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh data"
              onClick={() => setReload((x) => x + 1)}
            >
              <RefreshCw size={17} />
            </button>
            <div className="notification-area">
              <button
                className="icon-button notification-trigger"
                aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ""}`}
                aria-expanded={notificationOpen}
                onClick={() => setNotificationOpen((open) => !open)}
              >
                <Bell size={19} />
                {notificationCount > 0 && (
                  <span className="notification-count">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <div className="notification-menu" aria-label="Unread announcements">
                  <div className="notification-menu-heading">
                    <strong>Notifications</strong>
                    {unreadAnnouncements.length > 0 && (
                      <button
                        className="text-button"
                        onClick={() => void markAnnouncementsRead(unreadAnnouncements.map((item) => item.id))}
                      >
                        Mark shown read
                      </button>
                    )}
                  </div>
                  {unreadAnnouncements.length ? (
                    <div className="notification-list">
                      {unreadAnnouncements.map((item) => (
                        <button
                          className="notification-item"
                          key={item.id}
                          onClick={() => void viewAnnouncement(item)}
                        >
                          <strong>{item.title}</strong>
                          <span>{item.body}</span>
                          <small>
                            {new Date(item.created_at).toLocaleString("en-IN", {
                              timeZone: room?.timezone || "Asia/Kolkata",
                            })}
                          </small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="notification-empty">You’re all caught up.</p>
                  )}
                  <Link
                    className="notification-view-all"
                    href="/announcements"
                    onClick={() => setNotificationOpen(false)}
                  >
                    View announcements
                  </Link>
                </div>
              )}
            </div>
            <Link
              href="/settings"
              className="avatar small profile-avatar"
              aria-label={`Open settings for ${user.display_name}`}
            >
              {user.display_name[0]}
            </Link>
          </div>
        </header>
        <main className="main-content">
          {announcementPopup && (
            <section className="announcement-toast" role="alert" aria-live="assertive">
              <div className="announcement-toast-top">
                <span><Bell size={15} /> New room announcement</span>
                <button
                  className="icon-button"
                  aria-label="Dismiss announcement popup"
                  onClick={() => setAnnouncementPopup(null)}
                >
                  <X size={17} />
                </button>
              </div>
              <strong>{announcementPopup.title}</strong>
              <p>{announcementPopup.body}</p>
              <button
                className="text-button"
                onClick={() => void viewAnnouncement(announcementPopup)}
              >
                View announcement
              </button>
            </section>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {personalView
                  ? "A LITTLE SPACE FOR YOU"
                  : room
                    ? `${room.name.toUpperCase()} · ${room.members.filter((m) => m.status === "active").length} ROOMMATES`
                    : "WELCOME TO ROOMMATE LEDGER"}
              </span>
              <h1>
                {section === "/dashboard"
                  ? `Hey ${user.display_name.split(" ")[0]}, here’s the big picture.`
                  : title}
              </h1>
              <p>
                {section === "/dashboard"
                  ? "A clear view of what’s shared, what’s settled, and what’s next."
                  : personalView
                    ? "Your spending, your business. Visible only to you."
                    : section === "/balances"
                      ? "Know where you stand. Settle up when you’re ready."
                      : section === "/expenses"
                        ? "Everything you’ve shared, in one place."
                        : section === "/rooms"
                          ? "Your home and the people who make it."
                          : section === "/reports"
                            ? "See where the money goes. Every paisa accounted for."
                            : section === "/announcements"
                              ? "Keep everyone in the loop."
                              : "Make yourself at home."}
              </p>
            </div>
            <div className="button-row">
              {["/dashboard", "/expenses", "/personal/expenses"].includes(
                section,
              ) && (
                <button
                  className="button primary"
                  disabled={
                    !personalView &&
                    (!room ||
                      archived ||
                      (!isAdmin && !room.settings.allow_member_expenses))
                  }
                  onClick={expenseModal}
                >
                  <Plus size={18} />
                  {personalView ? "Add personal expense" : "Add expense"}
                </button>
              )}
              {section === "/balances" && (
                <button
                  className="button primary"
                  disabled={!room || archived}
                  onClick={() => setDialog({ kind: "settlement" })}
                >
                  <ArrowLeftRight size={17} />
                  Record payment
                </button>
              )}
              {section === "/rooms" && (
                <button
                  className="button primary"
                  onClick={() => setDialog({ kind: "room" })}
                >
                  <Plus size={17} />
                  Create room
                </button>
              )}
              {section === "/announcements" && (
                <button
                  className="button primary"
                  disabled={archived}
                  onClick={() => setDialog({ kind: "announcement" })}
                >
                  <Plus size={17} />
                  New announcement
                </button>
              )}
            </div>
          </div>
          {notice && (
            <div className="alert success" role="status">
              <Check size={17} />
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button
                className="text-button"
                onClick={() => setReload((v) => v + 1)}
              >
                Retry
              </button>
            </div>
          )}
          {archived && (
            <div className="alert warning">
              This room is archived. Its history is available for reference.
            </div>
          )}
          {section === "/dashboard" &&
            (!room ? (
              noRoom
            ) : (
              <>
                <section className="month-hero" aria-label="Monthly shared expenses">
                  <div className="month-hero-copy">
                    <span className="hero-eyebrow">{room.name} · THIS MONTH</span>
                    <span className="hero-label">Shared expenses</span>
                    <strong>{money(monthly?.total_paise || 0)}</strong>
                    <small>{monthly?.count || 0} shared expenses recorded this month</small>
                  </div>
                  <div className="month-hero-actions">
                    <button
                      className="button hero-primary"
                      disabled={archived || (!isAdmin && !room.settings.allow_member_expenses)}
                      aria-label="Record a shared expense"
                      onClick={() => setDialog({ kind: "expense" })}
                    >
                      <Plus size={17} /> Record expense
                    </button>
                    <Link className="button hero-secondary" href="/balances">
                      <ArrowLeftRight size={16} /> Settle up
                    </Link>
                  </div>
                </section>
                <div className="stats-grid">
                  <Stat
                    title="You paid"
                    amount={myMonth?.paid_paise || 0}
                    icon={<ArrowUpRight size={20} />}
                    detail="Contributed this month"
                  />
                  <Stat
                    title="Your share"
                    amount={myMonth?.share_paise || 0}
                    icon={<Users size={20} />}
                    detail="Of this month’s expenses"
                  />
                  <Stat
                    title={my && my.net_paise < 0 ? "You owe" : "You are owed"}
                    amount={Math.abs(my?.net_paise || 0)}
                    icon={<ArrowLeftRight size={20} />}
                    detail={
                      my?.net_paise
                        ? "All-time balance · after settlements"
                        : "All settled up. Looking good!"
                    }
                    highlight
                  />
                </div>
                <section className="panel category-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Monthly spending</h3>
                      <p>Where your household spent this month</p>
                    </div>
                    <Link href="/reports" className="text-button">
                      View report <ArrowRight size={15} />
                    </Link>
                  </div>
                  {topCategories.length ? (
                    <div className="category-grid">
                      {topCategories.map((item, index) => {
                        const category = categories.find((entry) => entry.id === item.category_id);
                        return (
                          <div className={`category-card tone-${index + 1}`} key={item.category_id || "uncategorized"}>
                            <span>{category?.name || "Uncategorized"}</span>
                            <strong>{money(item.amount_paise)}</strong>
                            <span className="category-progress" aria-hidden="true">
                              <span style={{ width: `${Math.max(6, Math.round((item.amount_paise / largestCategory) * 100))}%` }} />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="category-empty">Your monthly category breakdown will appear after expenses are recorded.</div>
                  )}
                </section>
                <div className="overview-grid">
                  <section className="panel expenses-panel">
                    <div className="panel-head">
                      <div>
                        <h3>Recent shared expenses</h3>
                        <p>The latest from your household</p>
                      </div>
                      <Link href="/expenses" className="text-button">
                        View all
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                    {loading ? (
                      <Spinner />
                    ) : expenses.items.length ? (
                      expenseTable(expenses.items.slice(0, 5))
                    ) : (
                      <Empty
                        title="Your ledger is a fresh page"
                        detail="Add a shared expense and we’ll take care of the splits."
                        action={
                          <button
                            className="button secondary"
                            disabled={archived}
                            onClick={() => setDialog({ kind: "expense" })}
                          >
                            Add your first expense
                          </button>
                        }
                      />
                    )}
                  </section>
                  <section className="balance-card">
                    <span className="eyebrow">YOUR HOUSEHOLD, IN BALANCE</span>
                    <div className="balance-art">
                      <House size={44} />
                      <span>
                        <Check size={14} />
                      </span>
                    </div>
                    <h3>
                      {suggestions.some(
                        (s) =>
                          s.from_user_id === user.id ||
                          s.to_user_id === user.id,
                      )
                        ? "A little settling up."
                        : "Good things add up."}
                    </h3>
                    <p>
                      {suggestions.some(
                        (s) =>
                          s.from_user_id === user.id ||
                          s.to_user_id === user.id,
                      )
                        ? "Keep your balances clear and your home happy."
                        : "Shared moments. Fair splits. One less thing to think about."}
                    </p>
                    <Link className="button light full" href="/balances">
                      See balances
                      <ArrowRight size={16} />
                    </Link>
                    <span className="balance-foot">
                      Only confirmed payments change your balance.
                    </span>
                  </section>
                </div>
                <div className="two-columns">
                  <section className="panel">
                    <div className="panel-head">
                      <h3>Roommates at a glance</h3>
                      <Link href="/rooms" className="text-button">
                        Manage
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                    <div className="member-summary">
                      {balances.map((b) => (
                        <div className="list-line" key={b.user_id}>
                          <div className="member-name">
                            <span className="avatar">
                              {person(b.user_id)[0]}
                            </span>
                            <div>
                              <strong>
                                {b.user_id === user.id
                                  ? "You"
                                  : person(b.user_id)}
                              </strong>
                              <small>
                                {b.net_paise > 0
                                  ? "Gets back"
                                  : b.net_paise < 0
                                    ? "Owes"
                                    : "Settled"}
                              </small>
                            </div>
                          </div>
                          <b className={b.net_paise < 0 ? "debt" : "credit"}>
                            {money(Math.abs(b.net_paise))}
                          </b>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-head">
                      <h3>On the noticeboard</h3>
                      <Link href="/announcements" className="text-button">
                        View all
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                    {announcements.items.length ? (
                      <div className="notice-list">
                        {announcements.items.slice(0, 2).map((a) => (
                          <article key={a.id}>
                            <span className="notice-dot" />
                            <div>
                              <h4>{a.title}</h4>
                              <p>{a.body}</p>
                              <small>
                                {new Date(a.created_at).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    timeZone: room.timezone,
                                  },
                                )}
                              </small>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="All quiet on the noticeboard"
                        detail="Room announcements will show up here."
                      />
                    )}
                    <div className="personal-callout">
                      <LockKeyhole size={19} />
                      <div>
                        <strong>A space just for your spending.</strong>
                        <p>Personal expenses stay out of the shared ledger.</p>
                      </div>
                      <Link
                        href="/personal/expenses"
                        aria-label="Open personal expenses"
                      >
                        <ArrowUpRight size={20} />
                      </Link>
                    </div>
                  </section>
                </div>
              </>
            ))}
          {(section === "/expenses" || personalView) && (
            <>
              {!room && !personalView ? (
                noRoom
              ) : (
                <>
                  <div className="toolbar">
                    <div className="search-box">
                      <Search size={17} />
                      <label className="sr-only" htmlFor="expense-search">
                        Search expenses
                      </label>
                      <input
                        id="expense-search"
                        placeholder="Search expenses…"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                    <div className="toolbar-right">
                      <label className="sr-only" htmlFor="category-filter">
                        Filter by category
                      </label>
                      <select
                        id="category-filter"
                        value={categoryFilter}
                        onChange={(e) => {
                          setCategoryFilter(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="">All categories</option>
                        {(personalView ? personalCategories : categories).map(
                          (c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ),
                        )}
                      </select>
                      <label className="date-filter">
                        From
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => {
                            setDateFrom(e.target.value);
                            setPage(1);
                          }}
                        />
                      </label>
                      <label className="date-filter">
                        To
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => {
                            setDateTo(e.target.value);
                            setPage(1);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  {personalView && (
                    <div className="privacy-note">
                      <LockKeyhole size={16} /> Only you can view and manage
                      these expenses. They never affect room balances.
                    </div>
                  )}
                  <section className="panel">
                    {loading ? (
                      <Spinner />
                    ) : (personalView ? personal : expenses).items.length ? (
                      expenseTable(
                        (personalView ? personal : expenses).items,
                        personalView,
                      )
                    ) : (
                      <Empty
                        title={
                          search || dateFrom || dateTo || categoryFilter
                            ? "No matching expenses"
                            : "Nothing recorded yet"
                        }
                        detail="Add an expense or adjust your filters to get started."
                      />
                    )}
                  </section>
                  {pagination((personalView ? personal : expenses).total)}
                </>
              )}
            </>
          )}
          {section === "/balances" &&
            (!room ? (
              noRoom
            ) : (
              <>
                <div className="balance-members">
                  {balances.map((b) => (
                    <div className="panel balance-member" key={b.user_id}>
                      <span className="avatar">{person(b.user_id)[0]}</span>
                      <h3>
                        {b.user_id === user.id ? "You" : person(b.user_id)}
                      </h3>
                      <span className={b.net_paise < 0 ? "debt" : "credit"}>
                        {b.net_paise > 0
                          ? "Gets back"
                          : b.net_paise < 0
                            ? "Owes"
                            : "All settled"}
                      </span>
                      <strong>{money(Math.abs(b.net_paise))}</strong>
                      <small>
                        Paid {money(b.paid_paise)} · Share{" "}
                        {money(b.share_paise)}
                      </small>
                    </div>
                  ))}
                </div>
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Suggested transfers</h3>
                      <p>A simple way to bring your balances to zero</p>
                    </div>
                    <span className="badge">Suggestions only</span>
                  </div>
                  {suggestions.length ? (
                    <div className="stack-list">
                      {suggestions.map((s, i) => (
                        <div className="list-line" key={i}>
                          <div className="transfer-names">
                            <span>{person(s.from_user_id)}</span>
                            <ArrowRight size={17} />
                            <span>{person(s.to_user_id)}</span>
                          </div>
                          <div className="button-row">
                            <b>{money(s.amount_paise)}</b>
                            {[s.from_user_id, s.to_user_id].includes(
                              user.id,
                            ) && (
                              <button
                                className="button secondary small-button"
                                disabled={archived}
                                onClick={() =>
                                  setDialog({ kind: "settlement", transfer: s })
                                }
                              >
                                Record payment
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Everyone’s square."
                      detail="There are no outstanding balances right now."
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <h3>Payment history</h3>
                    <span className="muted">
                      The recipient confirms receipt
                    </span>
                  </div>
                  {settlements.items.length ? (
                    <div className="stack-list">
                      {settlements.items.map((s) => (
                        <div className="list-line" key={s.id}>
                          <div>
                            <div className="transfer-names">
                              <b>{person(s.from_user_id)}</b>
                              <ArrowRight size={15} />
                              <b>{person(s.to_user_id)}</b>
                            </div>
                            <small>
                              {s.payment_method.toUpperCase()} ·{" "}
                              {new Date(s.created_at).toLocaleDateString(
                                "en-IN",
                              )}
                              {s.note && ` · ${s.note}`}
                            </small>
                          </div>
                          <div className="button-row">
                            <b>{money(s.amount_paise)}</b>
                            <span className={`badge ${s.status}`}>
                              {s.status}
                            </span>
                            {s.status === "pending" && !archived && (
                              <>
                                {s.to_user_id === user.id && (
                                  <>
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        setDialog({
                                          kind: "settlementAction",
                                          settlement: s,
                                          action: "confirm",
                                        })
                                      }
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      className="text-button danger"
                                      onClick={() =>
                                        setDialog({
                                          kind: "settlementAction",
                                          settlement: s,
                                          action: "reject",
                                        })
                                      }
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                {s.from_user_id === user.id && (
                                  <button
                                    className="text-button danger"
                                    onClick={() =>
                                      setDialog({
                                        kind: "settlementAction",
                                        settlement: s,
                                        action: "cancel",
                                      })
                                    }
                                  >
                                    Cancel
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="No payments recorded yet"
                      detail="Record a payment after sending money outside the app."
                    />
                  )}
                </section>
                {pagination(settlements.total)}
              </>
            ))}
          {section === "/reports" && (
            <Reports
              room={room}
              categories={[...categories, ...personalCategories]}
              members={members}
              notify={notify}
            />
          )}
          {section === "/announcements" &&
            (!room ? (
              noRoom
            ) : (
              <>
                <div className="announcement-grid">
                  {announcements.items.map((a) => (
                    <article className="panel announcement" key={a.id}>
                      <span className="badge">
                        <Bell size={12} />
                        Room announcement
                      </span>
                      <h2>{a.title}</h2>
                      <p>{a.body}</p>
                      <div className="list-line">
                        <small>
                          {new Date(a.created_at).toLocaleString("en-IN", {
                            timeZone: room.timezone,
                          })}
                        </small>
                        {isAdmin && !archived && (
                          <div className="button-row">
                            <button
                              className="text-button"
                              onClick={() =>
                                setDialog({
                                  kind: "announcement",
                                  announcement: a,
                                })
                              }
                            >
                              Edit
                            </button>
                            <button
                              className="text-button danger"
                              onClick={() =>
                                setDialog({
                                  kind: "archiveAnnouncement",
                                  announcement: a,
                                })
                              }
                            >
                              Archive
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {!announcements.items.length && (
                  <section className="panel">
                    <Empty
                      title="A clean noticeboard"
                      detail="Share an update with everyone in your room."
                    />
                  </section>
                )}
                {pagination(announcements.total)}
              </>
            ))}
          {section === "/rooms" && (
            <>
              <div className="toolbar">
                <h3>Your rooms</h3>
                <button
                  className="button secondary"
                  onClick={() => setDialog({ kind: "accept" })}
                >
                  Join with invitation
                </button>
              </div>
              <div className="room-grid">
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    className={`panel room-card ${roomId === r.id ? "selected" : ""}`}
                    onClick={() => setRoomId(r.id)}
                  >
                    <span className="room-symbol">
                      <House size={24} />
                    </span>
                    <h3>{r.name}</h3>
                    <p>
                      {r.members.filter((m) => m.status === "active").length}{" "}
                      members · {r.timezone}
                    </p>
                    <span className="badge">{r.status}</span>
                    {roomId === r.id && (
                      <Check className="room-selected" size={20} />
                    )}
                  </button>
                ))}
              </div>
              {room ? (
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>People in {room.name}</h3>
                      <p>Everyone has their place at the table</p>
                    </div>
                    {isAdmin && (
                      <button
                        className="button secondary"
                        disabled={archived}
                        onClick={() => setDialog({ kind: "invite" })}
                      >
                        <Plus size={16} />
                        Invite a roommate
                      </button>
                    )}
                  </div>
                  <div className="stack-list">
                    {members.map((m) => (
                      <div key={m.user_id} className="list-line">
                        <div className="member-name">
                          <span className="avatar">{m.display_name?.[0]}</span>
                          <div>
                            <strong>
                              {m.display_name}
                              {m.user_id === user.id ? " (you)" : ""}
                            </strong>
                            <small>
                              @{m.username} · {m.status}
                            </small>
                          </div>
                        </div>
                        <div className="button-row">
                          <span className="badge">
                            {m.role === "room_admin"
                              ? "Administrator"
                              : "Member"}
                          </span>
                          {isAdmin && !archived && (
                            <button
                              className="text-button"
                              onClick={() =>
                                setDialog({ kind: `member:${m.user_id}` })
                              }
                            >
                              Manage
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                noRoom
              )}
            </>
          )}
          {section === "/settings" && (
            <div className="two-columns">
              <section className="panel settings-panel">
                <h3>Your profile</h3>
                <p className="muted">Signed in as @{user.username}</p>
                <SimpleForm
                  fields={[
                    {
                      key: "display_name",
                      label: "Display name",
                      value: user.display_name,
                    },
                  ]}
                  submitLabel="Save profile"
                  action={async (values) => {
                    const updated = await patch<User>("/users/me", values);
                    setUser(updated);
                  }}
                  done={() => done("Profile updated.")}
                />
                <hr />
                <h3>Change password</h3>
                <PasswordForm
                  done={(u) => {
                    setUser(u);
                    notify(
                      "Password changed. Other sessions have been signed out.",
                    );
                  }}
                />
              </section>
              <div>
                {room && isAdmin && (
                  <section className="panel settings-panel">
                    <h3>Room preferences</h3>
                    <SimpleForm
                      fields={[
                        { key: "name", label: "Room name", value: room.name },
                        {
                          key: "timezone",
                          label: "Timezone",
                          value: room.timezone,
                        },
                      ]}
                      submitLabel="Save room"
                      action={(values) => patch(`/rooms/${room.id}`, values)}
                      done={() => done("Room updated.")}
                    />
                    <div className="preference-line">
                      <div>
                        <strong>Member expense entry</strong>
                        <p>Allow members to post shared expenses</p>
                      </div>
                      <input
                        aria-label="Allow member expenses"
                        type="checkbox"
                        checked={room.settings.allow_member_expenses}
                        onChange={async (e) => {
                          try {
                            await patch(`/rooms/${room.id}`, {
                              allow_member_expenses: e.target.checked,
                            });
                            await done("Room preference saved.");
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      />
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => setDialog({ kind: "archiveRoom" })}
                    >
                      {archived ? "Restore room" : "Archive room"}
                    </button>
                  </section>
                )}
                <section className="panel settings-panel">
                  <h3>
                    {room && isAdmin
                      ? "Room categories"
                      : "My personal categories"}
                  </h3>
                  <div className="category-list">
                    {(room && isAdmin ? categories : personalCategories).map(
                      (c) => (
                        <div key={c.id} className="list-line">
                          <span>
                            {c.name}
                            {!c.is_active ? " (archived)" : ""}
                          </span>
                          <button
                            className="text-button"
                            disabled={!!room && isAdmin && archived}
                            onClick={async () => {
                              try {
                                await patch(
                                  room && isAdmin
                                    ? `/rooms/${room.id}/categories/${c.id}`
                                    : `/personal/categories/${c.id}`,
                                  { is_active: !c.is_active },
                                );
                                await done("Category updated.");
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            {c.is_active ? "Archive" : "Restore"}
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                  <SimpleForm
                    fields={[{ key: "name", label: "New category name" }]}
                    submitLabel="Add category"
                    action={(v) =>
                      post(
                        room && isAdmin
                          ? `/rooms/${room.id}/categories`
                          : "/personal/categories",
                        v,
                      )
                    }
                    done={() => done("Category added.")}
                  />
                  {room && isAdmin && (
                    <button
                      className="text-button"
                      onClick={() => setDialog({ kind: "personalCategory" })}
                    >
                      Add a personal category
                    </button>
                  )}
                </section>
              </div>
            </div>
          )}
          {section === "/admin" &&
            (user.platform_role === "super_admin" ? (
              <Admin current={user} notify={notify} />
            ) : (
              <Empty
                title="Administrator access required"
                detail="This area is available to platform administrators."
              />
            ))}
          <footer className="page-footer">
            <span>
              <House size={13} /> RoomMate Ledger
            </span>
            <span>Shared fairly. Settled simply.</span>
          </footer>
        </main>
      </div>
      {dialog && (
        <Modal
          title={
            dialog.kind === "expense"
              ? "Add shared expense"
              : dialog.kind === "personal"
                ? "Add personal expense"
                : dialog.kind === "room"
                  ? "Create your household"
                  : dialog.kind === "invite"
                    ? "Invite a roommate"
                    : dialog.kind === "accept"
                      ? "Accept an invitation"
                      : dialog.kind === "settlement"
                        ? "Record a payment"
                        : dialog.kind === "detail" ||
                            dialog.kind === "personalDetail"
                          ? "Expense details"
                          : dialog.kind.startsWith("member:")
                            ? "Manage room member"
                            : dialog.kind === "announcement"
                              ? "Room announcement"
                              : "Confirm your action"
          }
          close={close}
        >
          {dialog.kind === "expense" && room && (
            <ExpenseForm
              room={room}
              members={members}
              categories={categories}
              user={user}
              done={() => done("Shared expense posted.")}
            />
          )}
          {dialog.kind === "personal" && (
            <ExpenseForm
              members={members}
              categories={personalCategories}
              user={user}
              personal
              done={() => done("Personal expense saved.")}
            />
          )}
          {dialog.kind === "editPersonal" && (
            <ExpenseForm
              existing={dialog.expense}
              members={members}
              categories={personalCategories}
              user={user}
              personal
              done={() => done("Personal expense updated.")}
            />
          )}
          {dialog.kind === "room" && (
            <SimpleForm
              fields={[{ key: "name", label: "Room name" }]}
              submitLabel="Create room"
              action={async (v) => {
                const result = await post<Room>("/rooms", v);
                setRoomId(result.id);
              }}
              done={() =>
                done("Your room is ready. Invite your roommates next.")
              }
            />
          )}
          {dialog.kind === "accept" && (
            <SimpleForm
              fields={[{ key: "token", label: "Invitation token" }]}
              note="Sign in with the username or email that received the invitation."
              submitLabel="Join room"
              action={async (v) => {
                const result = await post<Room>("/invitations/accept", v);
                setRoomId(result.id);
              }}
              done={() => done("Welcome to your new room.")}
            />
          )}
          {dialog.kind === "invite" &&
            room &&
            (inviteToken ? (
              <div className="form-stack">
                <div className="alert success">
                  Invitation created. Share this token privately with the
                  invited person.
                </div>
                <label className="field">
                  <span>One-time invitation token</span>
                  <textarea readOnly value={inviteToken} />
                </label>
                <button
                  className="button primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteToken);
                      notify("Invitation token copied.");
                    } catch {
                      notify("Select and copy the invitation token above.");
                    }
                  }}
                >
                  Copy invitation token
                </button>
                <p className="muted">
                  Expires in 7 days. The recipient creates an account, then
                  chooses “Join with invitation”.
                </p>
              </div>
            ) : (
              <SimpleForm
                fields={[
                  {
                    key: "email_or_username",
                    label: "Their username or email",
                  },
                ]}
                submitLabel="Create invitation"
                action={async (v) => {
                  const result = await post<{ token: string }>(
                    `/rooms/${room.id}/invitations`,
                    v,
                  );
                  setInviteToken(result.token);
                }}
                done={async () => {}}
              />
            ))}
          {dialog.kind === "settlement" && room && (
            <SettlementForm
              room={room}
              members={members}
              user={user}
              initial={dialog.transfer}
              done={() =>
                done("Payment recorded. Waiting for recipient confirmation.")
              }
            />
          )}
          {dialog.kind === "settlementAction" && room && dialog.settlement && (
            <SimpleForm
              fields={[]}
              note={`${dialog.action === "confirm" ? "Confirm you received" : `${dialog.action} payment of`} ${money(dialog.settlement.amount_paise)} from ${person(dialog.settlement.from_user_id)} to ${person(dialog.settlement.to_user_id)}?`}
              submitLabel={
                dialog.action === "confirm"
                  ? "Confirm receipt"
                  : `Confirm ${dialog.action}`
              }
              action={() =>
                post(
                  `/rooms/${room.id}/settlements/${dialog.settlement!.id}/${dialog.action}`,
                  {},
                )
              }
              done={() => done("Payment status updated.")}
            />
          )}
          {(dialog.kind === "detail" || dialog.kind === "personalDetail") &&
            dialog.expense && (
              <div className="form-stack">
                <div className="detail-total">
                  {money(
                    dialog.kind === "personalDetail"
                      ? dialog.expense.amount_paise!
                      : dialog.expense.total_paise,
                  )}
                </div>
                <h3>{dialog.expense.description}</h3>
                <p className="muted">
                  {dialog.expense.expense_date} · {dialog.expense.status}
                </p>
                {dialog.kind === "detail" &&
                  dialog.expense.splits.map((s) => (
                    <div className="list-line" key={s.user_id}>
                      <span>{person(s.user_id)}</span>
                      <b>{money(s.share_paise)}</b>
                    </div>
                  ))}
                {dialog.kind === "personalDetail" && (
                  <>
                    <p>{dialog.expense.notes}</p>
                    <div className="button-row">
                      <button
                        className="button secondary"
                        onClick={() =>
                          setDialog({
                            kind: "editPersonal",
                            expense: dialog.expense,
                          })
                        }
                      >
                        Edit expense
                      </button>
                      <button
                        className="button danger-button"
                        onClick={() =>
                          setDialog({
                            kind: "deletePersonal",
                            expense: dialog.expense,
                          })
                        }
                      >
                        Delete expense
                      </button>
                    </div>
                  </>
                )}
                {dialog.kind === "detail" &&
                  dialog.expense.status === "posted" &&
                  !archived &&
                  (isAdmin || dialog.expense.created_by === user.id) && (
                    <button
                      className="button danger-button"
                      onClick={() =>
                        setDialog({ kind: "reverse", expense: dialog.expense })
                      }
                    >
                      Reverse expense
                    </button>
                  )}
              </div>
            )}
          {dialog.kind === "reverse" && room && (
            <SimpleForm
              fields={[
                { key: "reason", label: "Reason for reversal", maxLength: 500 },
              ]}
              note="The expense stays in history and is excluded from balances and reports. Post a replacement expense if needed."
              submitLabel="Reverse expense"
              action={(v) =>
                post(
                  `/rooms/${room.id}/expenses/${dialog.expense!.id}/reverse`,
                  v,
                )
              }
              done={() => done("Expense reversed.")}
            />
          )}
          {dialog.kind === "deletePersonal" && (
            <SimpleForm
              fields={[]}
              note={`Delete “${dialog.expense!.description}” from your personal expenses?`}
              submitLabel="Delete personal expense"
              action={() =>
                api(`/personal/expenses/${dialog.expense!.id}`, {
                  method: "DELETE",
                })
              }
              done={() => done("Personal expense deleted.")}
            />
          )}
          {dialog.kind === "announcement" && room && (
            <SimpleForm
              fields={[
                {
                  key: "title",
                  label: "Title",
                  value: dialog.announcement?.title,
                },
                {
                  key: "body",
                  label: "Announcement",
                  type: "textarea",
                  value: dialog.announcement?.body,
                },
              ]}
              submitLabel={
                dialog.announcement
                  ? "Save announcement"
                  : "Publish announcement"
              }
              action={(v) =>
                dialog.announcement
                  ? patch(
                      `/rooms/${room.id}/announcements/${dialog.announcement.id}`,
                      v,
                    )
                  : post(`/rooms/${room.id}/announcements`, v)
              }
              done={() => done("Announcement saved.")}
            />
          )}
          {dialog.kind === "archiveAnnouncement" && room && (
            <SimpleForm
              fields={[]}
              note="Archive this announcement? It will no longer appear on the noticeboard."
              submitLabel="Archive announcement"
              action={() =>
                patch(
                  `/rooms/${room.id}/announcements/${dialog.announcement!.id}`,
                  { status: "archived" },
                )
              }
              done={() => done("Announcement archived.")}
            />
          )}
          {dialog.kind === "archiveRoom" && room && (
            <SimpleForm
              fields={[]}
              note={
                archived
                  ? "Restore this room for new activity?"
                  : "Archive this room? New financial activity will be blocked and all history retained."
              }
              submitLabel={archived ? "Restore room" : "Archive room"}
              action={() =>
                patch(`/rooms/${room.id}`, {
                  status: archived ? "active" : "archived",
                })
              }
              done={() => done("Room status updated.")}
            />
          )}
          {dialog.kind === "personalCategory" && (
            <SimpleForm
              fields={[{ key: "name", label: "Personal category name" }]}
              submitLabel="Add personal category"
              action={(v) => post("/personal/categories", v)}
              done={() => done("Personal category added.")}
            />
          )}
          {dialog.kind.startsWith("member:") && room && (
            <MemberManagement
              member={members.find(
                (m) => m.user_id === dialog.kind.split(":")[1],
              )!}
              room={room}
              done={() => done("Member updated.")}
            />
          )}
        </Modal>
      )}
      <nav className={`mobile-dock ${sideOpen ? "menu-open" : ""}`} aria-label="Mobile navigation">
        <Link href="/dashboard" className={`dock-item ${section === "/dashboard" ? "active" : ""}`} aria-current={section === "/dashboard" ? "page" : undefined}>
          <LayoutDashboard size={20} /><span>Home</span>
        </Link>
        <Link href="/expenses" className={`dock-item ${section === "/expenses" ? "active" : ""}`} aria-current={section === "/expenses" ? "page" : undefined}>
          <ReceiptText size={20} /><span>Expenses</span>
        </Link>
        <button
          className="dock-add"
          type="button"
          aria-label={personalView ? "Add personal expense" : "Create a shared expense"}
          disabled={!personalView && (!room || archived || (!isAdmin && !room.settings.allow_member_expenses))}
          onClick={expenseModal}
        >
          <span><Plus size={23} /></span><small>Add</small>
        </button>
        <Link href="/reports" className={`dock-item ${section === "/reports" ? "active" : ""}`} aria-current={section === "/reports" ? "page" : undefined}>
          <PieChart size={20} /><span>Reports</span>
        </Link>
        <button className={`dock-item ${sideOpen ? "active" : ""}`} type="button" aria-expanded={sideOpen} aria-label={sideOpen ? "Close more navigation" : "Open more navigation"} onClick={() => setSideOpen((open) => !open)}>
          <MoreHorizontal size={21} /><span>More</span>
        </button>
      </nav>
    </div>
  );
}

function Stat({
  title,
  amount,
  detail,
  icon,
  highlight = false,
}: {
  title: string;
  amount: number;
  detail: string;
  icon: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`stat-card ${highlight ? "highlight" : ""}`}>
      <div>
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{money(amount)}</strong>
      <small>{detail}</small>
    </div>
  );
}
function MemberManagement({
  member,
  room,
  done,
}: {
  member: Member;
  room: Room;
  done: () => Promise<void>;
}) {
  const [role, setRole] = useState(member.role),
    [status, setStatus] = useState(member.status),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await patch(`/rooms/${room.id}/members/${member.user_id}`, {
            role,
            status,
          });
          await done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormError error={error} />
      <h3>{member.display_name}</h3>
      <label className="field">
        <span>Room role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          <option value="room_member">Member</option>
          <option value="room_admin">Administrator</option>
        </select>
      </label>
      <label className="field">
        <span>Membership status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option>
          <option value="removed">Removed</option>
          <option value="left">Left</option>
        </select>
      </label>
      <p className="muted">
        The final active administrator is protected. Historical expenses and
        balances are retained.
      </p>
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Save member"}
      </button>
    </form>
  );
}
