import type { StaticImageData } from 'next/image';
import type { RafflePrizeDto } from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import lakePhoto from './assets/lake.jpeg';
import logoBluvi from './assets/logo_bluvi.png';

/*
 * All Romanian copy of the raffle flow — a port of fish constants/raffleCopy.ts (Bluvi & PescarMania
 * Expo raffle), shared by every /tombola page (intro, confirmation, status, receipt upload, winners).
 * fish's own spelling is kept; where fish had a typo the web fixes it and says so.
 */

const BRAND = 'Bluvi & PescarMania';
const EXPO_2026 = 'Fishing and Hunting Expo 2026';

/** Mesaj standard pentru bonul fiscal PescarMania (minim 150 lei, 2 șanse în plus). */
export const BON_FISCAL_PESCARMANIA =
  'Cumpără de minim 150 lei de la PescarMania, înscrie bonul fiscal și primești 2 șanse în plus la tragerea la sorți.';

const RECEIPT_DISCLAIMER = 'Dacă câștigi, vom verifica bonul fiscal. Dacă bonul nu este corect sau este duplicat, vei fi descalificat.';

/** A bundled image's URL: Next imports give StaticImageData, Vitest gives the path string. */
function assetUrl(img: StaticImageData | string): string {
  return typeof img === 'string' ? img : img.src;
}

/**
 * fish `rafflePrizes`: shown while the session has no prizes of its own (participant.raffle-intro.c5).
 * fish's `valueLei` is the DTO's `priceLei` here, so one PrizeRow renders both.
 */
export const STATIC_PRIZES: RafflePrizeDto[] = [
  { title: 'Echipament premium de pescuit', priceLei: 500, count: 2, typeKey: 'crap', image: { url: assetUrl(lakePhoto) } },
  { title: 'Merchandise Bluvi', priceLei: 150, count: 5, typeKey: 'feeder', image: { url: assetUrl(logoBluvi) } },
  { title: 'Premii speciale expoziție', priceLei: 300, count: 3, typeKey: 'rapitor', image: { url: assetUrl(lakePhoto) } },
];

/** The session's prizes, else the static ones (fish raffle/index.tsx:42-43). */
export function prizesToShow(sessionPrizes: RafflePrizeDto[]): { prizes: RafflePrizeDto[]; fromSession: boolean } {
  return sessionPrizes.length > 0 ? { prizes: sessionPrizes, fromSession: true } : { prizes: STATIC_PRIZES, fromSession: false };
}

/**
 * fish ExpandablePrizeRow / the type tiles: «{n} înscriși» for every n (fish bug, «1 înscriși»);
 * the web goes through formatCount: «1 înscris» / «2 înscriși» / «20 de înscriși».
 */
export function registrationsLabel(n: number): string {
  return formatCount(n, 'înscris', 'înscriși');
}

/**
 * Labels for STATIC_PRIZES' type keys when the session has no type with that key (fish shows the
 * raw key, «rapitor»; the web shows the word with its diacritics).
 */
const STATIC_TYPE_LABELS: Record<string, string> = { crap: 'Crap', feeder: 'Feeder', rapitor: 'Răpitor' };

/** A prize's type label: the session type's, else the static key's word, else the key itself. */
export function prizeTypeLabel(typeKey: string | null | undefined, sessionLabel: string | null | undefined): string {
  if (sessionLabel) return sessionLabel;
  if (!typeKey) return '';
  return STATIC_TYPE_LABELS[typeKey] ?? typeKey;
}

/** «1 șansă» / «3 șanse» / «20 de șanse» (formatCount: the «de» from 20). */
export function chancesLabel(n: number): string {
  return formatCount(n, 'șansă', 'șanse');
}

export const raffleCopy = {
  dashboard: {
    title: `Tragere la sorți ${BRAND}`,
    expoEventName: EXPO_2026,
    prizesShort: 'Participă și câștigă echipamente de pescuit!',
    statusAvailable: 'Înscrie-te la tombolă',
    statusJoined: 'Vezi șansele tale',
    statusEndedNoWinners: 'Tombola încheiată – câștigătorii vor fi anunțați',
    ctaSeeWinners: 'Vezi câștigători',
    yourChances: 'șanse',
    registeredCount: (current: number) => formatCount(current, 'participant', 'participanți'),
    prizesDescription: BON_FISCAL_PESCARMANIA,
    addBonFiscalPrompt: `Mărește-ți șansele! ${BON_FISCAL_PESCARMANIA}`,
    countdownPrefix: 'Închidere în',
  },
  intro: {
    pageTitle: 'Tragere la sorți',
    prizesHeading: 'Participă la tragerea la sorți pentru șansa de a câștiga echipamente de pescuit și premii speciale',
    prizesBody:
      'Alătură-te competiției noastre și ai șansa să câștigi echipamente premium de pescuit și alte premii exclusive de la Bluvi Expo.',
    typesTitle: 'Alege tipul premiilor',
    typesBody:
      'Selectează secțiunea în care vrei să intri: Crap, Feeder sau Răpitor. Poți schimba tipul mai târziu, până aproape de încheierea tombolei.',
    prizesTitle: 'Premii',
    howItWorksTitle: 'Cum funcționează',
    howItWorksSteps: ['Înscrie-te în tragerea la sorți prin aplicație', 'Primești automat 1 șansă de câștig', BON_FISCAL_PESCARMANIA],
    bonusTitle: 'Bonus pentru clienți',
    bonusText: BON_FISCAL_PESCARMANIA,
    ctaJoin: 'Intră în tragerea la sorți',
    ctaJoining: 'Se înscrie…',
    regulationCheckboxLabel: 'Am citit regulamentul tombolei',
    viewRegulationLink: 'Vezi regulament',
    regulationDialogTitle: 'Regulament',
    addReceiptBeforeJoin: 'Adaugă bon fiscal PescarMania',
    addReceiptBeforeJoinHint: BON_FISCAL_PESCARMANIA,
    takePhoto: 'Fotografiază',
    pickFromGallery: 'Din galerie',
    removeReceipt: 'Elimină imaginea',
    receiptPreviewAlt: 'Bonul fiscal ales',
    receiptVerificationDisclaimer: RECEIPT_DISCLAIMER,
    errorsTitle: 'Erori',
    errors: {
      regulation: 'Te rugăm să accepți regulamentul tombolei (bifează că ai citit regulamentul).',
      closed: 'Înscrierile pentru tombolă nu mai sunt deschise.',
      type: 'Te rugăm să alegi tipul premiilor (Crap, Feeder sau Răpitor).',
      join: 'Nu am putut finaliza înscrierea. Te rugăm să încerci din nou.',
    },
    /** Web only: the join went through, the receipt did not (the toast over the confirmation, c14). */
    receiptFailedAfterJoin: 'Ești înscris, dar bonul nu a putut fi încărcat. Îl poți adăuga de aici.',
    /** Web only: a session without types can never be joined (c12); said above the CTA. */
    noTypesNote: 'Înscrierile nu sunt încă disponibile.',
    summaryTitle: 'Înscrierea ta',
    summaryType: 'Tipul premiilor',
    /** fish «Nealeas» (a typo of «neales»); the web says it in full. */
    summaryTypeNone: 'Nu ai ales încă',
    summaryChancesNow: 'La înscriere',
    summaryChancesReceipt: 'Cu bonul fiscal',
  },
  confirmation: {
    title: 'Confirmare participare',
    message: 'Ești înscris în tragerea la sorți!',
    messageWithCategory: (category: string) => `Ești înscris în tragerea la sorți pentru categoria ${category}!`,
    subMessage: 'Mult succes! Îți ținem pumnii!',
    currentChancesLabel: 'ȘANSELE TALE ACTUALE',
    chanceSingular: 'șansă',
    chancePlural: 'șanse',
    bonusHeading: 'Mărește-ți șansele de câștig!',
    bonusInstructions: BON_FISCAL_PESCARMANIA,
    bonusHighlight: '+2',
    bonusHighlightLabel: 'Șanse bonus pentru încărcarea bonului fiscal',
    uploadCta: 'Încarcă bonul fiscal',
    laterCta: 'Închide',
    receiptUploadedTitle: 'Mărește-ți șansele de câștig!',
    receiptUploadedLabel: 'Bonul tău încărcat',
    receiptUploadedDescription: 'Ai 2 șanse de câștig în plus pentru că ai adăugat bonul.',
  },
  uploadReceipt: {
    title: 'Încarcă bonul fiscal',
    titleReplace: 'Înlocuiește bonul fiscal',
    titleAdd: 'Adaugă bon fiscal',
    instructionsTitle: 'Instrucțiuni',
    instructions: `Fă o fotografie bonului tău fiscal. ${BON_FISCAL_PESCARMANIA}`,
    receiptVerificationDisclaimer: RECEIPT_DISCLAIMER,
    uploadSectionTitle: 'Încarcă bonul fiscal',
    uploadSectionSubtitle: 'Alege o metodă de încărcare',
    takePhoto: 'Fotografiază acum',
    pickFromGallery: 'Încarcă din galerie',
    uploading: 'Se încarcă bonul…',
    /** fish swallows a failed upload (no catch); the web says so and keeps the dialog open. */
    uploadFailed: 'Nu am putut încărca bonul. Te rugăm să încerci din nou.',
    tipsTitle: 'Sfaturi pentru o fotografie bună',
    tips: [
      'Asigură-te că bonul este complet vizibil',
      'Verifică ca data și numele magazinului să fie lizibile',
      'Folosește lumină naturală pentru claritate',
    ],
    previewTitle: 'Bonul tău încărcat',
    /** fish «Înlocuie cu…» (a typo, RaffleUploadReceiptSheet.tsx:116); the upload page has the right verb. */
    previewHint: 'Înlocuiește cu o nouă fotografie mai jos.',
  },
  receiptSubmitted: {
    title: 'Bon încărcat',
    underVerification: 'Bonul tău este în curs de verificare.',
    approvedMessage: 'Bonul a fost aprobat! Ai primit 2 șanse bonus.',
    entryBreakdown: 'Detalii șanse',
    previous: 'Înainte',
    bonusPending: 'Bonus (în așteptare)',
    bonusApproved: 'Bonus',
    total: 'Total',
    goToStatus: 'Vezi șansele mele',
  },
  status: {
    title: 'Șansele mele',
    totalChancesLabel: 'ȘANSELE TALE TOTALE',
    chancesToWin: 'șanse de câștig',
    entryLabel: 'Intrare',
    bonusLabel: 'Bonus',
    totalLabel: 'Total',
    countdownLabel: 'Câștigătorul anunțat în:',
    prizesTitle: 'Premii pe care le poți câștiga',
    addReceiptCta: 'Încarcă bon fiscal',
    replaceReceiptCta: 'Înlocuiește bonul',
    deleteReceiptCta: 'Șterge bonul',
    receiptSectionTitle: 'Bon fiscal PescarMania (min. 150 lei)',
    receiptPreviewTitle: 'Bonul tău încărcat',
    totalChancesWithReceipt: 'Total șanse cu bon:',
    receiptCutoffHint: 'Nu mai poți modifica bonul după termenul limită.',
    backToHomeCta: 'Înapoi acasă',
  },
  phoneRequired: {
    title: 'Completează numărul de telefon',
    message: 'Avem nevoie de numărul tău de telefon pentru a te contacta dacă câștigi.',
    label: 'Număr de telefon',
    placeholder: '07xxxxxxxx',
    required: 'Introdu numărul de telefon',
    min: 'Minim 7 caractere',
    cta: 'Salvează',
    close: 'Închide',
    saved: 'Număr salvat.',
    saveFailed: 'Eroare la salvare.',
  },
  winners: {
    title: 'Câștigători',
    perCategory: 'Categoria',
    noWinnersYet: 'Câștigătorii nu au fost anunțați încă.',
    winnersLabel: 'Câștigători',
  },
  prizeItems: {
    countLabel: (n: number) => (n === 1 ? '1 produs' : formatCount(n, 'produs', 'produse')),
  },
  close: 'Închide',
} as const;

export type ReceiptUploadMode = 'first' | 'add' | 'replace';

/** fish RaffleUploadReceiptSheet / upload-receipt.tsx title per mode. */
export function receiptDialogTitle(mode: ReceiptUploadMode): string {
  return mode === 'replace' ? raffleCopy.uploadReceipt.titleReplace : mode === 'add' ? raffleCopy.uploadReceipt.titleAdd : raffleCopy.uploadReceipt.title;
}

/** fish: the «Bonul tău încărcat» preview only in replace mode with a receipt already uploaded. */
export function showReceiptPreview(mode: ReceiptUploadMode, receiptUploaded: boolean, receiptImageUrl: string | null): boolean {
  return mode === 'replace' && receiptUploaded && Boolean(receiptImageUrl);
}

/** fish ExpandablePrizeRow subtitle: «{description} · {price} LEI × {count}», or the description alone without a price. */
export function prizeSubtitle(prize: Pick<RafflePrizeDto, 'description' | 'priceLei' | 'count'>): string | null {
  if (prize.priceLei != null) {
    return prize.description ? `${prize.description} · ${prize.priceLei} LEI × ${prize.count}` : `${prize.priceLei} LEI × ${prize.count}`;
  }
  return prize.description ?? null;
}

export type JoinErrorKey = keyof typeof raffleCopy.intro.errors;

/**
 * fish handleJoin's checks, in its order (participant.raffle-intro.c12): the regulation, then the
 * registration window, then the type. null = go on (to the phone check, then the join).
 */
export function joinBlocker(s: { regulationAccepted: boolean; isRegistrationOpen: boolean; selectedTypeKey: string | null }): JoinErrorKey | null {
  if (!s.regulationAccepted) return 'regulation';
  if (!s.isRegistrationOpen) return 'closed';
  if (!s.selectedTypeKey) return 'type';
  return null;
}
