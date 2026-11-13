"use client";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, House, ShieldCheck, Wallet, Users } from "lucide-react";
import { login, post } from "@/lib/api";
import type { User } from "@/lib/types";
import { Field, FormError, Spinner } from "./ui";
export function Auth({
  done,
  checking = false,
}: {
  done: (u: User) => void;
  checking?: boolean;
}) {
  const [register, setRegister] = useState(false),
    [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [display, setDisplay] = useState(""),
    [email, setEmail] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (register)
        await post("/auth/register", {
          username: identifier,
          password,
          display_name: display,
          email: email || null,
        });
      done(await login(identifier, password));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <a className="brand light" href="/">
          <span className="brand-icon">
            <House size={23} />
          </span>
          RoomMate<span>Ledger</span>
        </a>
        <div className="auth-copy">
          <span className="eyebrow">SHARED SPACE. CLEAR BALANCES.</span>
          <h1>
            Less keeping score.
            <br />
            More living together.
          </h1>
          <p>
            A home for your household expenses. Split fairly, settle simply, and
            keep the little things between friends.
          </p>
          <div className="auth-illustration">
            <div className="illustration-icon">
              <Users size={58} />
            </div>
            <span className="float-card one">
              <Wallet size={20} /> Every paisa accounted for{" "}
              <ShieldCheck size={17} />
            </span>
            <span className="float-card two">
              <span className="teal-dot" /> A little more together
            </span>
          </div>
        </div>
        <p className="auth-footer">
          Built for shared homes. Made for peace of mind.
        </p>
      </section>
      <main className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow teal">YOUR HOME, IN BALANCE</span>
          <h2>{register ? "Make yourself at home." : "Welcome back."}</h2>
          <p className="muted">
            {register
              ? "Create an account, then create a room or accept an invitation."
              : "Sign in to see where things stand."}
          </p>
          {checking ? (
            <Spinner />
          ) : (
            <form onSubmit={submit} className="form-stack">
              <FormError error={error} />
              {register && (
                <Field label="Your name">
                  <input
                    required
                    autoComplete="name"
                    value={display}
                    onChange={(e) => setDisplay(e.target.value)}
                  />
                </Field>
              )}
              <Field label={register ? "Username" : "Username or email"}>
                <input
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    register ? "e.g. kavin" : "Enter your username or email"
                  }
                />
              </Field>
              {register && (
                <Field label="Email (optional)">
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              )}
              <Field
                label={
                  register ? "Password (at least 12 characters)" : "Password"
                }
              >
                <input
                  required
                  type="password"
                  minLength={register ? 12 : undefined}
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </Field>
              <button className="button primary full" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create account"
                    : "Sign in"}
                <ArrowUpRight size={18} />
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setRegister(!register);
                  setError("");
                }}
              >
                {register
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </button>
              <p className="auth-recovery">
                Need a password reset? Contact your platform administrator.
                Email recovery is not configured.
              </p>
            </form>
          )}
          <div className="privacy-foot">
            <ShieldCheck size={16} /> Your personal expenses stay personal.
          </div>
        </div>
      </main>
    </div>
  );
}
