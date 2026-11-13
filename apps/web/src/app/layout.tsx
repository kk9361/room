import type { Metadata } from "next";
import "./globals.css";
import { LedgerApp } from "@/components/ledger-app";
export const metadata: Metadata = {
  title: "RoomMate Ledger · A little more together",
  description:
    "Shared household expenses, clear balances, and private personal spending.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LedgerApp />
        {children}
      </body>
    </html>
  );
}
