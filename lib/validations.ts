import { z } from "zod";

// Profile form
export const profileSchema = z.object({
  username: z
    .string()
    .min(2, "Numele trebuie sa aiba cel putin 2 caractere")
    .max(50, "Numele este prea lung"),
  phone: z
    .string()
    .regex(/^(\+?[0-9]{10,15})?$/, "Numar de telefon invalid")
    .or(z.literal("")),
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

// Registration form
export const registrationSchema = z.object({
  teamName: z.string().optional(),
  phone: z.string().min(1, "Numarul de telefon este obligatoriu"),
  notes: z.string().optional(),
});
export type RegistrationFormValues = z.infer<typeof registrationSchema>;

// Weighing catch
export const weighingCatchSchema = z.object({
  weight: z
    .number({ required_error: "Greutatea este obligatorie" })
    .positive("Greutatea trebuie sa fie pozitiva")
    .max(100, "Greutatea maxima este 100 kg"),
  fishType: z.string().optional(),
});
export type WeighingCatchValues = z.infer<typeof weighingCatchSchema>;

// Competition creation — Step 1: Basics
export const competitionBasicsSchema = z
  .object({
    name: z.string().min(3, "Numele competitiei trebuie sa aiba cel putin 3 caractere"),
    startDate: z.string().min(1, "Data de inceput este obligatorie"),
    endDate: z.string().min(1, "Data de sfarsit este obligatorie"),
    registerFee: z.string().min(1, "Taxa de inscriere este obligatorie"),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.endDate) > new Date(data.startDate);
      }
      return true;
    },
    { message: "Data de sfarsit trebuie sa fie dupa data de inceput", path: ["endDate"] },
  );
export type CompetitionBasicsValues = z.infer<typeof competitionBasicsSchema>;

// Competition creation — Step 2: Config
export const competitionConfigSchema = z.object({
  competitionType: z.enum(["single", "team"]),
  participantsLimit: z
    .string()
    .min(1, "Numarul de locuri este obligatoriu")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Trebuie sa fie un numar pozitiv"),
  teamParticipants: z.string().optional(),
});
export type CompetitionConfigValues = z.infer<typeof competitionConfigSchema>;

// Competition creation — Step 3: Ranking
export const competitionRankingSchema = z.object({
  rankingType: z.string().min(1, "Tipul de clasament este obligatoriu"),
  bestOfFishCount: z.string().optional(),
  numberOfWinners: z.string().optional(),
  minFishWeight: z.string().optional(),
  excludeBiggestCatch: z.boolean().optional(),
  generalRankingWinnerMode: z.string().optional(),
  gridRule: z.string().optional(),
});
export type CompetitionRankingValues = z.infer<typeof competitionRankingSchema>;

// Competition creation — Step 4: Lake & Sectors
export const competitionLakeSectorsSchema = z.object({
  lakeId: z.string().min(1, "Selecteaza o balta"),
  lakeName: z.string().min(1, "Numele baltii este obligatoriu"),
  sectors: z.string().optional(),
  sponsors: z.string().optional(),
});
export type CompetitionLakeSectorsValues = z.infer<typeof competitionLakeSectorsSchema>;
