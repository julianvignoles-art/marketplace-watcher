"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "The Board" },
  { href: "/wishlist", label: "Want Ads" },
  { href: "/settings", label: "Settings" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return null;

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-paper">
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
        <div className="flex items-baseline justify-between pb-3">
          <Link href="/" className="font-display text-xl tracking-tight text-ink-950">
            Marketplace Watcher
          </Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl2 px-3 py-1.5 text-sm transition-colors ${
                  pathname === link.href
                    ? "bg-ink-950 text-paper"
                    : "text-ink-600 hover:text-ink-950"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={logout}
              className="ml-2 rounded-xl2 px-3 py-1.5 text-sm text-ink-600 hover:text-pin"
            >
              Log out
            </button>
          </nav>
        </div>
        <div className="border-t-[3px] border-ink-950 pt-[3px]">
          <div className="border-t border-ink-950/70" />
        </div>
      </div>
    </header>
  );
}
