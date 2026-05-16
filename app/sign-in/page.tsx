"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const providers = [
    process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" ? { id: "google", label: "Continua cu Google" } : null,
    process.env.NEXT_PUBLIC_FACEBOOK_ENABLED === "true" ? { id: "facebook", label: "Continua cu Facebook" } : null,
    process.env.NEXT_PUBLIC_APPLE_ENABLED === "true" ? { id: "apple", label: "Continua cu Apple" } : null,
  ].filter(Boolean) as Array<{ id: string; label: string }>;

  async function handleCredentials(event: React.FormEvent) {
    event.preventDefault();
    const result = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if (result?.error) {
      setMessage("Autentificarea a esuat.");
      return;
    }

    if (result?.url) {
      router.push(result.url);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] items-center px-4 py-10">
      <div className="surface-card w-full rounded-sheet p-8">
        <Image src="/logo.svg" alt="Bluvi" width={56} height={56} />
        <h1 className="mt-6 text-3xl font-bold text-gray-7">Intra in ecosistemul Bluvi</h1>
        <p className="mt-2 text-sm text-gray-5">Autentificare sociala sau cu email pentru dashboard, inscrieri si organizer flows.</p>
        {providers.length ? (
          <>
            <div className="mt-6 grid gap-3">
              {providers.map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  onClick={() => signIn(provider.id, { callbackUrl: "/dashboard" })}
                >
                  {provider.label}
                </Button>
              ))}
            </div>
            <div className="my-6 h-px bg-gray-2" />
          </>
        ) : null}
        <form className="space-y-4" onSubmit={handleCredentials}>
          <Input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Email" />
          <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Parola" type="password" />
          {message ? <p className="text-sm text-red-5">{message}</p> : null}
          <Button type="submit" className="w-full">
            Autentificare cu email
          </Button>
        </form>
      </div>
    </main>
  );
}
