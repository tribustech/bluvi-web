import { Header } from "@/components/shared/header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto min-h-screen max-w-[1280px] px-4 py-8 md:px-8">{children}</main>
    </>
  );
}
