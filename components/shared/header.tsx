"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn, isOrganizerRole } from "@/lib/utils";
import { MobileNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

const navLinks = [
  { href: "/", label: "Acasa" },
  { href: "/lakes", label: "Balti" },
  { href: "/competitions", label: "Competitii" },
  { href: "/news", label: "Noutati" },
];

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isOrganizer = isOrganizerRole(session?.user?.role?.name);

  return (
    <header className="sticky top-0 z-40 bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.svg" alt="Bluvi" width={36} height={36} />
          <span className="text-xl font-bold text-indigo-7">Bluvi</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-bold transition-colors",
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? "text-indigo-7"
                  : "text-gray-5 hover:text-indigo-7",
              )}
            >
              {link.label}
            </Link>
          ))}
          {isOrganizer ? (
            <Link
              href="/organizer"
              className={cn(
                "text-sm font-bold transition-colors",
                pathname.startsWith("/organizer") || pathname.startsWith("/create-competition")
                  ? "text-indigo-7"
                  : "text-gray-5 hover:text-indigo-7",
              )}
            >
              Organizator
            </Link>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {session ? (
            <>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/sign-in">Autentificare</Link>
            </Button>
          )}
          <MobileNav isOrganizer={isOrganizer} />
        </div>
      </div>
    </header>
  );
}
