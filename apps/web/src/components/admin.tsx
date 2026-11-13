"use client";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import { api, patch, post, setToken } from "@/lib/api";
import type { Page, Room, User } from "@/lib/types";
import { FormError, Spinner, Modal, Field } from "./ui";
import { SimpleForm } from "./forms";
type Account = User & { status: string };
type Audit = {
  id: string;
  action: string;
  actor_user_id: string;
  resource_type: string;
  resource_id: string;
  created_at: string;
  request_id: string;
};
export function Admin({
  current,
  notify,
}: {
  current: User;
  notify: (m: string) => void;
}) {
  const [tab, setTab] = useState("users"),
    [users, setUsers] = useState<Page<Account>>(),
    [rooms, setRooms] = useState<Page<Room>>(),
    [audit, setAudit] = useState<Page<Audit>>();
  const [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [clearOpen, setClearOpen] = useState(false),
    [clearPassword, setClearPassword] = useState(""),
    [clearPhrase, setClearPhrase] = useState(""),
    [clearBusy, setClearBusy] = useState(false),
    [clearError, setClearError] = useState("");
  const closeClear = useCallback(() => {
    if (clearBusy) return;
    setClearOpen(false);
    setClearPassword("");
    setClearPhrase("");
    setClearError("");
  }, [clearBusy]);
  const [confirm, setConfirm] = useState<{
    id: string;
    type: string;
    status: string;
    name: string;
  } | null>(null);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api<Page<Account> | Page<Room> | Page<Audit>>(`/admin/${tab}?page=${page}`)
      .then((data) => {
        if (!live) return;
        if (tab === "users") setUsers(data as Page<Account>);
        else if (tab === "rooms") setRooms(data as Page<Room>);
        else setAudit(data as Page<Audit>);
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [tab, page, version]);
  const total =
    (tab === "users" ? users : tab === "rooms" ? rooms : audit)?.total || 0;
  return (
    <>
      <div className="toolbar">
        <div className="segmented">
          {[
            ["users", "Accounts"],
            ["rooms", "All rooms"],
            ["audit-logs", "Audit log"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => {
                setTab(value);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="muted">
          Platform support · personal expense content stays private
        </span>
        <button
          className="button danger-button"
          onClick={() => setClearOpen(true)}
        >
          Clear all data
        </button>
      </div>
      <FormError error={error} />
      {error && (
        <button
          className="button secondary"
          onClick={() => setVersion((x) => x + 1)}
        >
          Retry
        </button>
      )}
      {loading ? (
        <Spinner />
      ) : (
        <section className="panel table-wrap">
          <table>
            <thead>
              {tab === "users" ? (
                <tr>
                  <th>Account</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              ) : tab === "rooms" ? (
                <tr>
                  <th>Room</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              ) : (
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Request ID</th>
                </tr>
              )}
            </thead>
            <tbody>
              {tab === "users"
                ? users?.items.map((x) => (
                    <tr key={x.id}>
                      <td>{x.display_name}</td>
                      <td>{x.username}</td>
                      <td>{x.platform_role}</td>
                      <td>
                        <span className="badge">{x.status}</span>
                      </td>
                      <td>
                        {x.id !== current.id &&
                          x.platform_role !== "super_admin" && (
                            <button
                              className="text-button"
                              onClick={() =>
                                setConfirm({
                                  id: x.id,
                                  type: "users",
                                  status:
                                    x.status === "active"
                                      ? "disabled"
                                      : "active",
                                  name: x.display_name,
                                })
                              }
                            >
                              {x.status === "active" ? "Disable" : "Enable"}
                            </button>
                          )}
                      </td>
                    </tr>
                  ))
                : tab === "rooms"
                  ? rooms?.items.map((x) => (
                      <tr key={x.id}>
                        <td>{x.name}</td>
                        <td>
                          {
                            x.members.filter((m) => m.status === "active")
                              .length
                          }
                        </td>
                        <td>
                          <span className="badge">{x.status}</span>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              setConfirm({
                                id: x.id,
                                type: "rooms",
                                status:
                                  x.status === "active" ? "archived" : "active",
                                name: x.name,
                              })
                            }
                          >
                            {x.status === "active" ? "Archive" : "Restore"}
                          </button>
                        </td>
                      </tr>
                    ))
                  : audit?.items.map((x) => (
                      <tr key={x.id}>
                        <td>
                          {new Date(x.created_at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })}
                        </td>
                        <td>{x.action}</td>
                        <td>
                          {x.resource_type} · {x.resource_id.slice(0, 8)}
                        </td>
                        <td className="mono">{x.request_id.slice(0, 12)}</td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </section>
      )}
      <div className="pagination">
        <span>{total} records</span>
        <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button
          disabled={page * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
      {confirm && (
        <Modal
          title={`Change ${confirm.name} status?`}
          close={() => setConfirm(null)}
        >
          <SimpleForm
            fields={[]}
            note={`Set status to ${confirm.status}. Financial history is retained.`}
            submitLabel="Confirm change"
            action={() =>
              patch(`/admin/${confirm.type}/${confirm.id}/status`, {
                status: confirm.status,
              })
            }
            done={async () => {
              setConfirm(null);
              setVersion((x) => x + 1);
              notify("Status updated.");
            }}
          />
        </Modal>
      )}
      {clearOpen && (
        <Modal title="Clear all application data?" close={closeClear}>
          <form
            className="form-stack"
            onSubmit={async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              setClearError("");
              setClearBusy(true);
              try {
                const result = await post<{ total_deleted: number }>(
                  "/admin/clear-data",
                  {
                    confirmation: "CLEAR ALL DATA",
                    current_password: clearPassword,
                  },
                );
                setClearOpen(false);
                setClearPassword("");
                setClearPhrase("");
                setToken(null);
                window.alert(
                  `Deleted ${result.total_deleted} database records and accounts. Restart the API to recreate its configured bootstrap administrator, then sign in again.`,
                );
                window.location.assign("/");
              } catch (e) {
                setClearError((e as Error).message);
              } finally {
                setClearBusy(false);
              }
            }}
          >
            <FormError error={clearError} />
            <div className="alert error">
              <strong>
                This permanently deletes every record and account from the
                connected database.
              </strong>
              <p>
                All rooms, memberships, invitations, shared and personal
                expenses, settlements, categories, announcements, user
                accounts, sessions, and audit history will be erased. Restart
                the API afterward to recreate the bootstrap administrator from
                its configuration. You will need those credentials to sign in
                again. Backups stored outside this database are not deleted.
              </p>
            </div>
            <Field label="Your administrator password">
              <input
                type="password"
                autoComplete="current-password"
                required
                value={clearPassword}
                onChange={(event) => setClearPassword(event.target.value)}
              />
            </Field>
            <Field label="Type CLEAR ALL DATA to confirm">
              <input
                autoComplete="off"
                required
                value={clearPhrase}
                onChange={(event) => setClearPhrase(event.target.value)}
              />
            </Field>
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                disabled={clearBusy}
                onClick={closeClear}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button danger-button"
                disabled={clearBusy || clearPhrase !== "CLEAR ALL DATA"}
              >
                {clearBusy ? "Clearing data…" : "Permanently clear all data"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
