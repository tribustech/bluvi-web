"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCompetitionRegistration } from "@/services/api/registrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  teamName: z.string().optional(),
  phone: z.string().min(10, "Telefonul este obligatoriu"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function RegistrationForm({ competitionId }: { competitionId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      teamName: "",
      phone: "",
      notes: "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      await createCompetitionRegistration(competitionId, values);
      setStatus("Inscriere trimisa cu succes.");
      form.reset();
    } catch {
      setStatus("Nu am putut trimite inscrierea. Verifica autentificarea si backend-ul.");
    }
  }

  return (
    <form className="surface-card rounded-card space-y-4 p-5" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <Input placeholder="Nume echipa (optional)" {...form.register("teamName")} />
        <Input placeholder="Telefon" {...form.register("phone")} />
      </div>
      <Textarea placeholder="Observatii" {...form.register("notes")} />
      {status ? <p className="text-sm text-gray-5">{status}</p> : null}
      <Button type="submit">Trimite inscrierea</Button>
    </form>
  );
}
