import Link from "next/link";
import { Typography } from "@/components/ui/typography";

export function Footer() {
  return (
    <footer className="mt-16 bg-white shadow-[inset_0_1px_0_#f2f2f2]">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-10 md:grid-cols-3 md:px-8">
        <div>
          <Typography preset="heading2" className="mb-2">
            Bluvi
          </Typography>
          <Typography preset="body2" color="#737373">
            Platforma pentru competitii de pescuit, balti, stiri si experiente organizate modern.
          </Typography>
        </div>
        <div className="space-y-2">
          <Typography preset="helper">Exploreaza</Typography>
          <div className="flex flex-col gap-1 text-sm text-gray-5">
            <Link href="/competitions">Competitii</Link>
            <Link href="/lakes">Balti</Link>
            <Link href="/news">Noutati</Link>
          </div>
        </div>
        <div className="space-y-2">
          <Typography preset="helper">Cont</Typography>
          <div className="flex flex-col gap-1 text-sm text-gray-5">
            <Link href="/sign-in">Autentificare</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/profile">Profil</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
