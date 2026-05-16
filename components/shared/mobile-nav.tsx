"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ isOrganizer }: { isOrganizer: boolean }) {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <button className="rounded-full border border-gray-2 bg-white p-2 text-gray-7">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Meniu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-3">
            <Link href="/">Acasa</Link>
            <Link href="/lakes">Balti</Link>
            <Link href="/competitions">Competitii</Link>
            <Link href="/news">Noutati</Link>
            {isOrganizer ? <Link href="/organizer">Organizator</Link> : null}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
