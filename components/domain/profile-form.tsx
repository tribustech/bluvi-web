"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, User, Check, Loader2 } from "lucide-react";
import type { Profile } from "@/types";
import { updateProfile } from "@/services/api/profile";
import { uploadMedia } from "@/services/api/media";
import { resolveMediaUrl, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const profileSchema = z.object({
  username: z.string().min(2, "Numele trebuie sa aiba cel putin 2 caractere").max(50, "Numele este prea lung"),
  phone: z.string().regex(/^(\+?[0-9]{10,15})?$/, "Numar de telefon invalid").or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: profile?.username || "",
      phone: profile?.phone || "",
    },
  });

  const currentAvatarUrl = avatarPreview || resolveMediaUrl(
    profile?.avatar && "url" in profile.avatar ? profile.avatar.url : undefined,
  );

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: "Imaginea nu poate depasi 5 MB.", type: "error" });
      return;
    }

    setAvatarPreview(URL.createObjectURL(file));
    setIsUploading(true);

    try {
      const result = await uploadMedia(file);
      const uploadedId = Array.isArray(result) ? result[0]?.id : (result as { id?: number })?.id;
      if (uploadedId) {
        await updateProfile({ avatar: uploadedId });
        setMessage({ text: "Avatar actualizat.", type: "success" });
      }
    } catch {
      setMessage({ text: "Nu am putut incarca imaginea.", type: "error" });
      setAvatarPreview(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function onSubmit(values: ProfileFormValues) {
    try {
      await updateProfile(values);
      setMessage({ text: "Profilul a fost actualizat.", type: "success" });
    } catch {
      setMessage({ text: "Nu am putut salva modificarile.", type: "error" });
    }
  }

  return (
    <form className="space-y-6 rounded-card bg-white p-6 shadow-[0_5px_15px_rgba(0,0,0,0.08)]" onSubmit={form.handleSubmit(onSubmit)}>
      {/* Avatar upload */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 transition",
              currentAvatarUrl ? "border-transparent shadow-[0_0_0_2px_#A5B4FC]" : "border-dashed border-gray-2",
            )}
          >
            {currentAvatarUrl ? (
              <Image src={currentAvatarUrl} alt="Avatar" width={80} height={80} className="h-full w-full rounded-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-gray-5" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-gray-7/40 opacity-0 transition group-hover:opacity-100">
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-7">Fotografie de profil</p>
          <p className="text-xs text-gray-5">JPG, PNG. Max 5 MB.</p>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-bold text-gray-7">Nume utilizator</label>
          <Input placeholder="Nume utilizator" {...form.register("username")} />
          {form.formState.errors.username && (
            <p className="mt-1 text-xs text-red-5">{form.formState.errors.username.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-bold text-gray-7">Telefon</label>
          <Input placeholder="Telefon" {...form.register("phone")} />
          {form.formState.errors.phone && (
            <p className="mt-1 text-xs text-red-5">{form.formState.errors.phone.message}</p>
          )}
        </div>
      </div>

      {message && (
        <div className={cn(
          "flex items-center gap-2 rounded-card px-4 py-2 text-sm font-semibold",
          message.type === "success" ? "bg-green-2 text-green-7" : "bg-red-1 text-red-5",
        )}>
          {message.type === "success" && <Check className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Salveaza
      </Button>
    </form>
  );
}
