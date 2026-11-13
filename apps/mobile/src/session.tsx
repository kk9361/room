import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Alert } from "react-native";
import {
  api,
  post,
  restore,
  signIn,
  signOut,
  onUnauthorized,
  type User,
  type Room,
  type Page,
  type Announcement,
} from "./api";
type Session = {
  user: User | null;
  setUser: (u: User | null) => void;
  rooms: Room[];
  room?: Room;
  setRoomId: (id: string) => void;
  loading: boolean;
  error: string;
  unreadAnnouncementCount: number;
  unreadAnnouncementIds: string[];
  markAnnouncementRead: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  login: (id: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [rooms, setRooms] = useState<Room[]>([]),
    [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);
  const [unreadAnnouncementIds, setUnreadAnnouncementIds] = useState<string[]>([]);
  const seenAnnouncementIds = useRef(new Map<string, Set<string>>()),
    showingAnnouncement = useRef(false);
  const activeRoom = rooms.find((room) => room.id === roomId);
  const markAnnouncementRead = useCallback(async (id: string) => {
    if (!activeRoom) return;
    const result = await post<{ marked_read: number }>(
      `/rooms/${activeRoom.id}/announcements/read`,
      { announcement_ids: [id] },
    );
    setUnreadAnnouncementIds((ids) => ids.filter((item) => item !== id));
    setUnreadAnnouncementCount((count) => Math.max(0, count - result.marked_read));
  }, [user?.id, activeRoom?.id]);
  const refresh = useCallback(async () => {
    if (!user || user.must_change_password) return;
    setError("");
    const data = await api<Page<Room>>("/rooms?page_size=100");
    setRooms(data.items);
    setRoomId((id) =>
      data.items.some((r) => r.id === id) ? id : data.items[0]?.id || "",
    );
  }, [user]);
  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      setRooms([]);
    });
    (async () => {
      try {
        if (await restore()) setUser(await api<User>("/auth/me"));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    setUnreadAnnouncementCount(0);
    setUnreadAnnouncementIds([]);
    if (!user || user.must_change_password || !activeRoom) {
      return;
    }
    let live = true;
    let pending = false;
    const room = activeRoom;
    const notificationKey = `${user.id}:${room.id}`;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await api<{ items: Announcement[]; total: number }>(
          `/rooms/${room.id}/announcements/unread`,
        );
        if (!live) return;
        setUnreadAnnouncementCount(data.total);
        setUnreadAnnouncementIds(data.items.map((item) => item.id));
        const seen = seenAnnouncementIds.current.get(notificationKey) || new Set<string>();
        seenAnnouncementIds.current.set(notificationKey, seen);
        const next = data.items.find((item) => !seen.has(item.id));
        if (next && !showingAnnouncement.current) {
          seen.add(next.id);
          showingAnnouncement.current = true;
          Alert.alert(
            next.title,
            next.body,
            [
              {
                text: "Later",
                style: "cancel",
                onPress: () => {
                  showingAnnouncement.current = false;
                },
              },
              {
                text: "Mark read",
                onPress: () => {
                  markAnnouncementRead(next.id)
                    .catch((e) => setError((e as Error).message))
                    .finally(() => {
                      showingAnnouncement.current = false;
                    });
                },
              },
            ],
            {
              cancelable: true,
              onDismiss: () => {
                showingAnnouncement.current = false;
              },
            },
          );
        }
      } catch {
        // Retry when the next foreground poll runs.
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 10000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [user?.id, user?.must_change_password, activeRoom?.id, markAnnouncementRead]);
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        rooms,
        room: activeRoom,
        unreadAnnouncementCount,
        unreadAnnouncementIds,
        markAnnouncementRead,
        setRoomId,
        loading,
        error,
        refresh,
        login: async (id, password) => {
          setError("");
          setUser(await signIn(id, password));
        },
        logout: async () => {
          try {
            await signOut();
          } finally {
            setUser(null);
            setRooms([]);
            setRoomId("");
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionProvider is missing");
  return value;
}
