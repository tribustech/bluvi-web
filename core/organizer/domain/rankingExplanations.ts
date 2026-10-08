import { getGeneralPriorityMetric, type GeneralModeValue } from './createCompetition';
import { getGeneralRankingOptions, RANKING_TYPES } from './rankingConfig';

/*
 * The ranking explanations the wizard shows (step «Tip clasament» panel, ?explicatie=):
 *  - fish constants/rankingExplanations.ts (RANKING_EXPLANATIONS) + the fallback of
 *    app/(app)/create-competition/ranking-explanation.tsx («Necunoscut»);
 *  - fish constants/generalRankingModeExplanations.ts (per type × general mode);
 *  - fish step-ranking.tsx getGeneralModeGroupExplanation (the «Cum funcționează departajarea la …» sheet);
 *  - fish constants/gridRuleExplanation.ts.
 * Copy is fish's, word for word, with one web rule applied (ROADMAP §4b rule 11, never say
 * «capot»): «(capot)» is dropped after «fără capturi» / «fără pește», «un singur capot» reads «o
 * singură pereche fără capturi» and «Capot (zero capturi)» reads «Fără capturi».
 */

export interface ExplanationSection {
  heading?: string;
  body: string;
}

export interface RankingExplanation {
  title: string;
  sections: ExplanationSection[];
}

export const RANKING_EXPLANATIONS: Readonly<Record<string, RankingExplanation>> = {
  quantity: {
    title: '⚖️ Cantitate',
    sections: [
      {
        heading: 'Ce este',
        body: 'Cel mai simplu tip de clasament. Echipele sunt ordonate după greutatea totală a tuturor capturilor. Nu contează numărul de pești sau media — doar cât de greu cântărește tot ce ai prins.\n\nAcest tip de clasament premiază volumul: cu cât prinzi mai multă cantitate, cu atât ești mai bine clasat.',
      },
      {
        heading: 'Cum funcționează',
        body: '1. Se adună greutatea tuturor capturilor fiecărei echipe\n2. Echipele sunt ordonate descrescător în sector\n3. La egalitate, se compară cel mai mare pește\n4. Echipele fără capturi primesc punctajul maxim și împart ultimul loc\n\nNu există concept de grilă — toate echipele cu capturi sunt tratate egal.',
      },
      {
        heading: 'Clasament general',
        body: '📊 După poziția în sector (implicit): Locurile 1 din toate sectoarele concurează între ele, locurile 2 între ele, etc. În cadrul fiecărui grup: cantitate → cel mai mare pește.\n\n🔢 După punctaj: Toate echipele ordonate direct după cantitate totală.',
      },
      {
        heading: 'Departajare',
        body: 'În sector:\n1. Cantitate totală — mai mare câștigă\n2. Cel mai mare pește — mai mare câștigă\n\nDacă ambele sunt egale, echipele împart același loc.',
      },
      {
        heading: 'Cazuri speciale',
        body: '• Niciun stand nu are capturi → toate echipele împart ultimul loc\n• Două echipe cu aceeași cantitate și cel mai mare pește → împart același loc și primesc aceleași puncte\n• excludeBiggestCatch activat → cel mai mare pește din întreaga competiție este exclus din calcul (dar rămâne pentru departajare)',
      },
    ],
  },
  quality: {
    title: '🏆 Calitate',
    sections: [
      {
        heading: 'Ce este',
        body: 'Clasamentul ordonează echipele după media greutății celor mai bune N capturi (unde N = numărul minim de pești al sectorului).\n\nPremiază calitatea capturilor — nu contează câți pești ai prins în total, ci cât de buni sunt cei mai buni N pești ai tăi.',
      },
      {
        heading: 'Cum funcționează',
        body: '1. Se ordonează capturile descrescător după greutate\n2. Se selectează primele N capturi (cele mai grele)\n3. Se calculează media: suma greutăților / N\n4. Se verifică grila (nr. capturi ≥ nrPestiPeSector)\n\nEchipele cu grilă sunt clasate primele. Echipele fără grilă primesc punctaj maxim.',
      },
      {
        heading: 'Conceptul de grilă',
        body: 'Grila = o echipă a prins cel puțin N pești (N = nrPestiPeSector al sectorului).\n\n• Echipele cu grilă concurează pe baza calității (media top N)\n• Echipele fără grilă sunt clasate după, conform regulii de departajare alese',
      },
      {
        heading: 'Clasament general',
        body: '📊 După poziția în sector: Locurile 1 concurează pentru primele poziții generale, locurile 2 pentru următorul set, etc.\n\n🔢 După punctaj: Toate echipele cu grilă ordonate direct după calitate.',
      },
      {
        heading: 'Departajare',
        body: 'Echipe cu grilă:\n1. Calitate (media top N) — mai mare câștigă\n2. Cel mai mare pește — mai mare câștigă\n\nEchipe fără grilă (conform regulii de departajare alese):\n• După numărul de capturi: nr. pești → cantitate → cel mai mare pește\n• După media greutății: media → cantitate → cel mai mare pește',
      },
    ],
  },
  quantityQuality: {
    title: '⚖️🏆 Cantitate/Calitate',
    sections: [
      {
        heading: 'Ce este',
        body: 'Similar cu Calitate/Cantitate, dar cu ordinea de departajare inversată. Fiecare echipă primește puncte separate pentru calitate și cantitate. Suma punctelor determină poziția.\n\nDiferența apare la egalitate de puncte — cantitatea departajează prima.',
      },
      {
        heading: 'Cum funcționează',
        body: '1. Se calculează punctaj Calitate: echipele cu grilă ordonate după media top N capturi\n2. Se calculează punctaj Cantitate: toate echipele ordonate după greutatea totală\n3. Suma punctelor (Calitate + Cantitate) determină poziția\n4. La egalitate, se compară: cantitate → calitate → cel mai mare pește',
      },
      {
        heading: 'Exemplu rapid',
        body: 'Echipa A: puncte calitate = 2, puncte cantitate = 1 → Total: 3\nEchipa B: puncte calitate = 1, puncte cantitate = 2 → Total: 3\n\nLa egalitate (3 = 3), se compară cantitatea. Echipa cu cantitatea mai mare câștigă.',
      },
      {
        heading: 'Departajare la egalitate de puncte',
        body: '1. Cantitate totală — mai mare câștigă\n2. Calitate (media top N) — mai mare câștigă\n3. Cel mai mare pește — mai mare câștigă',
      },
    ],
  },
  qualityQuantity: {
    title: '🏆⚖️ Calitate/Cantitate',
    sections: [
      {
        heading: 'Ce este',
        body: 'Combină două criterii: calitatea (media celor mai bune capturi) și cantitatea (greutatea totală). Fiecare echipă primește puncte separate, iar suma determină poziția.\n\nLa departajare, calitatea primează — de aici numele "Calitate/Cantitate".',
      },
      {
        heading: 'Cum funcționează',
        body: '1. Punctaj Calitate: media celor mai grele N capturi (N = nrPestiPeSector). Echipele fără grilă primesc calitate 0.\n2. Punctaj Cantitate: greutatea totală a tuturor capturilor\n3. Suma punctelor determină poziția finală\n4. La egalitate: calitate → cantitate → cel mai mare pește',
      },
      {
        heading: 'Exemplu rapid',
        body: 'Echipa A: puncte calitate = 1, puncte cantitate = 3 → Total: 4\nEchipa B: puncte calitate = 3, puncte cantitate = 1 → Total: 4\n\nLa egalitate (4 = 4), calitatea departajează. Echipa cu calitatea mai bună câștigă.',
      },
      {
        heading: 'Departajare la egalitate de puncte',
        body: '1. Calitate (media top N) — mai mare câștigă\n2. Cantitate totală — mai mare câștigă\n3. Cel mai mare pește — mai mare câștigă',
      },
    ],
  },
  bestOf: {
    title: '🎯 Best of',
    sections: [
      {
        heading: 'Ce este',
        body: 'Selectează cei mai grei N pești din fiecare sector și clasifică echipele în funcție de câți pești au în acest top.\n\nNu contează media sau cantitatea totală, ci câți din peștii tăi au intrat în topul sectorului.',
      },
      {
        heading: 'Cum funcționează',
        body: '1. Se calculează N = numărul de pești pentru clasament / numărul de sectoare\n2. În fiecare sector, toți peștii sunt ordonați descrescător\n3. Se selectează primii N pești (cei mai grei)\n4. Fiecare echipă primește puncte = câți pești are în top\n5. Mai mulți pești în top = loc mai bun',
      },
      {
        heading: 'Regula Split',
        body: 'Dacă ultimul pește selectat are aceeași greutate cu un pește neselectat, peștii egali sunt marcați ca "split" și incluși în top.\n\nAsta previne situația injustă în care un pește cu greutate egală ar fi exclus arbitrar.',
      },
      {
        heading: 'Departajare',
        body: 'În sector:\n1. Număr de pești în top N — mai mulți câștigă\n2. Greutatea totală a peștilor din top — mai mare câștigă\n3. Cel mai mare pește — mai mare câștigă',
      },
    ],
  },
  nationalChampionship: {
    title: '🇷🇴 Campionat Național',
    sections: [
      {
        heading: 'Ce este',
        body: 'Implementează regulile oficiale FIPS-CIPS. Este un clasament pe cluburi, nu pe echipe individuale.\n\nFiecare club are exact 3 echipe (DUO-uri), câte una în fiecare din cele 3 sectoare obligatorii.',
      },
      {
        heading: 'Structura obligatorie',
        body: '• Exact 3 sectoare\n• Fiecare club are exact 3 echipe (câte una per sector)\n• Clasament principal pe cluburi, cu clasament individual ca suport',
      },
      {
        heading: 'Cum funcționează',
        body: '1. În fiecare sector, echipele sunt ordonate după cantitate totală\n2. Fiecare echipă primește puncte = poziția în sector (loc 1 = 1 punct, loc 2 = 2 puncte...)\n3. Clubul primește suma punctelor tuturor celor 3 echipe\n4. Clubul cu cele mai puține puncte câștigă',
      },
      {
        heading: 'Egalitate de greutate',
        body: 'La egalitate, se calculează media pozițiilor ocupate:\n\n• 2 echipe egale pe locurile 5-6 → ambele primesc (5+6)/2 = 5.5 puncte\n• 3 echipe egale pe locurile 8-10 → toate primesc (8+9+10)/3 = 9 puncte',
      },
      {
        heading: 'Echipe fără capturi',
        body: '• O singură echipă fără capturi → primește ultimul loc\n• Mai multe echipe fără capturi → împart pozițiile rămase, primind media punctelor',
      },
    ],
  },
  fipsed: {
    title: '🌍 Campionat Mondial FIPSed',
    sections: [
      {
        heading: 'Ce este',
        body: 'Clasament pentru competițiile între națiuni după regulile oficiale FIPSed Carp Fishing. Fiecare națiune are 3 perechi (câte una în fiecare sector), iar clasamentul principal este pe națiuni.',
      },
      {
        heading: 'Structură obligatorie',
        body: '• Exact 3 sectoare\n• Fiecare națiune are exact 3 perechi (una per sector)\n• Clasament principal pe națiuni + clasament general pe perechi',
      },
      {
        heading: 'Punctaj în sector',
        body: '1. Perechile sunt ordonate după cantitatea totală din sector\n2. Egalitate de cantitate: se acordă media locurilor ocupate\n3. Perechile fără capturi: primesc media locurilor neatribuite; dacă e o singură pereche fără capturi, primește ultimul loc',
      },
      {
        heading: 'Clasament general pe perechi',
        body: 'Locurile 1 din sectoare concurează între ele, apoi locurile 2 etc. La egalitate în grup: cantitate totală → cel mai mare pește → număr mai mic de pești.',
      },
      {
        heading: 'Clasament pe națiuni',
        body: 'Națiunea cu cele mai puține puncte totale câștigă. Departajare oficială: cantitate totală națiune → cea mai mare cantitate a unei perechi → cel mai mare pește al națiunii → număr mai mic de pești.',
      },
    ],
  },
  bestOfTiers: {
    title: '🪜 Best of x, y, z...',
    sections: [
      {
        heading: 'Ce este',
        body: 'Best of cu praguri multiple. Organizatorul stabilește o listă de praguri (ex: 9, 7, 5, 3), iar fiecare prag câștigă un loc pe podium. O echipă poate lua un singur premiu — odată câștigat un loc, iese din concurs pentru cele de sub el.',
      },
      {
        heading: 'Exemplu cu [9, 7, 5, 3]',
        body: '• Locul 1: cea mai bună medie din primele 9 capturi\n• Locul 2: cea mai bună medie din primele 7 capturi, dintre cei rămași\n• Locul 3: cea mai bună medie din primele 5 capturi, dintre cei rămași\n• Locul 4: cea mai bună medie din primele 3 capturi, dintre cei rămași',
      },
      {
        heading: 'Dacă nimeni nu atinge un prag',
        body: 'Locul rămâne neacordat. Echipele rămase continuă să concureze pentru pragurile mai mici.',
      },
      {
        heading: 'Departajare la un prag',
        body: 'Dacă două echipe au aceeași medie pentru top N, câștigă cea cu cel mai mare pește. Dacă și acela e egal, se compară al doilea, al treilea ș.a.m.d. Echipele identice pe tot top N împart locul.',
      },
      {
        heading: 'Sub podium',
        body: 'Echipele care nu câștigă niciun loc:\n• Cele care au atins cel puțin un prag: ordonate după cel mai mare prag atins, apoi după media la acel prag\n• Cele care nu ating niciun prag: ordonate după număr de capturi, cantitate, cel mai mare pește\n• Fără capturi: împart ultima poziție',
      },
    ],
  },
  feederRounds: {
    title: '🔁 Feeder pe manșe (FIPS)',
    sections: [
      {
        heading: 'Ce este',
        body: 'Concurs de feeder în 1, 2 sau 3 manșe (de obicei câte una pe zi). Înainte de fiecare manșă nouă se trage din nou la sorți, iar organizatorul reașază participanții pe standuri în aplicație. Sectoarele rămân aceleași, doar participanții se mută.',
      },
      {
        heading: 'Punctaj pe manșă',
        body: 'În fiecare sector, cel cu cea mai mare cantitate primește 1 punct, următorul 2 puncte și așa mai departe. Contează doar sectorul în care ai pescuit în manșa respectivă.\n\n• Cantități egale: media locurilor (ex: locurile 5 și 6 → 5,5 puncte fiecare)\n• Fără pește: media locurilor rămase neocupate în sector',
      },
      {
        heading: 'Clasamentul final',
        body: 'Suma punctelor din toate manșele. Cel mai mic total câștigă. Exemplu: locul 1 în sectorul A în manșa 1 și locul 4 în sectorul C în manșa 2 → 5 puncte.',
      },
      {
        heading: 'Departajare',
        body: '1. Cantitatea totală din toate manșele (mai mare)\n2. Cea mai bună cantitate dintr-o singură manșă\n3. Cel mai mic punctaj dintr-o singură manșă\n\nCine nu a pescuit într-o manșă se clasează după toți cei care au pescuit în toate manșele.',
      },
      {
        heading: 'Desfășurare',
        body: 'Organizatorul închide manșa după ce toate cântarele sunt finalizate, introduce standurile trase pentru manșa următoare, apoi o pornește. Cântarele dintr-o manșă închisă nu mai pot fi redeschise. Cu o singură manșă nu e nimic de închis sau reașezat: concursul se încheie direct.',
      },
    ],
  },
  calitateCalitate: {
    title: '🏆🏆 Calitate/Calitate',
    sections: [
      {
        heading: 'Ce este',
        body: 'Cel mai complex tip de clasament. Combină două componente de calitate:\n\n• Cal1 = media capturilor fără cel mai mare pește (măsoară constanța)\n• Cal2 = greutatea celui mai mare pește (măsoară performanța de vârf)\n\nPremiază atât constanța cât și performanța excepțională.',
      },
      {
        heading: 'Cum funcționează',
        body: '1. Se scoate cel mai mare pește\n2. Cal1: se iau următoarele N capturi (N = nrPestiPeSector) și se calculează media\n3. Cal2: greutatea celui mai mare pește\n4. Se calculează puncte separate la Cal1 și Cal2\n5. Suma punctelor (Cal1 + Cal2) determină poziția',
      },
      {
        heading: '⚠️ Grilă specială',
        body: 'La Calitate/Calitate, grila necesită mai mult de nrPestiPeSector pești (nu egal cu).\n\nExemplu: cu nrPestiPeSector = 5, echipa trebuie să prindă cel puțin 6 pești ca să facă grilă — pentru că cel mai mare pește este exclus din Cal1.',
      },
      {
        heading: 'Departajare',
        body: 'La egalitate de puncte totale:\n1. Cal1 (constanța) — mai mare câștigă\n2. Cal2 (cel mai mare pește) — mai mare câștigă\n3. Cantitate totală — mai mare câștigă',
      },
    ],
  },
  calitateCantitateCMMC: {
    title: '🏆⚖️🐟 Calitate/Cantitate/CMMC',
    sections: [
      {
        heading: 'Ce este',
        body: 'Trei clasamente independente pe fiecare sector:\n\n• CALITATE — media celor mai grele N capturi fără cea mai mare captură (N = nrPestiPeSector)\n• CANTITATE — greutatea totală a tuturor capturilor\n• CMMC (Cea Mai Mare Captură) — separat de CALITATE\n\nPuncte separate la fiecare clasament, însumate. La clasamentul general, echipele se grupează pe poziția din sector (1 cu 1, 2 cu 2, etc.); la egalitate primează cantitatea.',
      },
      {
        heading: 'Cum funcționează',
        body: '1. Cea mai mare captură este pusă deoparte pentru CMMC\n2. CALITATE: media următoarelor N capturi\n3. CANTITATE: suma greutății tuturor capturilor (inclusiv cea mai mare)\n4. CMMC: greutatea celei mai mari capturi\n5. Fiecare clasament dă puncte (1 = cel mai bun, mai multe = mai prost)\n6. Total = puncte Cal. + puncte Cant. + puncte CMMC\n7. În sector: ordonare după total crescător\n8. În general: grupare pe poziția din sector, apoi total crescător',
      },
      {
        heading: '⚠️ Grilă specială',
        body: 'Grila pentru CALITATE necesită cu o captura mai mult decat "nrPestiPeSector" , pentru ca cea mai mare este exclusă pentru CMMC. Echipele fără grilă primesc punctaj maxim la CALITATE.\n\nCANTITATE și CMMC nu au grilă — toate echipele cu capturi concurează direct.',
      },
      {
        heading: 'Departajare la general',
        body: 'În cadrul aceluiași grup de poziție de sector, la egalitate de puncte totale:\n1. Cantitate totală — mai mare câștigă\n2. Cea mai mare captură — mai mare câștigă\n3. Număr de capturi — mai multe câștigă',
      },
    ],
  },
};

/** fish ranking-explanation.tsx: an unknown type is «Necunoscut» / «Tip de clasament necunoscut.». */
export const UNKNOWN_RANKING_EXPLANATION: RankingExplanation = {
  title: 'Necunoscut',
  sections: [{ body: 'Tip de clasament necunoscut.' }],
};

export function getRankingExplanation(rankingType?: string | null): RankingExplanation {
  return (rankingType && RANKING_EXPLANATIONS[rankingType]) || UNKNOWN_RANKING_EXPLANATION;
}

/* ------------------------------------------------------------------ */
/* General ranking mode — fish constants/generalRankingModeExplanations.ts */
/* ------------------------------------------------------------------ */

const GENERAL_RANKING_MODE_EXPLANATIONS: Readonly<Record<string, RankingExplanation>> = {
  'quantity:bySectorPosition': {
    title: '📊 După poziția în sector, primează Cantitatea',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'Locurile 1 din toate sectoarele concurează între ele, apoi locurile 2, și așa mai departe. În fiecare grup, departajarea se face după cantitate totală, apoi după cel mai mare pește.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 sunt ambele pe locul 1 în sector. A1 are 42 kg, iar B5 are 40 kg. A1 câștigă grupa și primește poziția generală mai bună.',
      },
    ],
  },
  'quantity:byPoints': {
    title: '🔢 După punctaj',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'Toate echipele sunt ordonate direct în clasamentul general, fără grupare pe poziții de sector. La egalitate de cantitate, decide cel mai mare pește.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 au ambele 35 kg. A1 are peștele maxim de 11.2 kg, iar B5 are 10.9 kg. A1 este înainte.',
      },
    ],
  },
  'quality:bySectorPosition': {
    title: '📊 După poziția în sector, primează Calitatea',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'Locurile 1 din sectoare se compară între ele, apoi locurile 2 etc. În fiecare grup, primează calitatea (media top N), apoi cel mai mare pește.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 sunt ambele pe locul 1 în sector. A1 are media 6.20, iar B5 are media 6.05. A1 câștigă grupa.',
      },
    ],
  },
  'quality:byPoints': {
    title: '🔢 După punctaj',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'Echipele sunt ordonate direct după punctajul de calitate. Dacă punctajul este egal, decide calitatea, apoi cel mai mare pește.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 au același punctaj total. A1 are media top N mai mare, deci A1 este înainte.',
      },
    ],
  },
  'quantityQuality:bySectorPosition': {
    title: '📊 După poziția în sector, primează Cantitatea',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'Generalul se construiește pe grupe de poziție de sector. În acest mod, la egalitate primează cantitatea și la sector, și la general.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 au câte 2 puncte și sunt ambele pe locul 1 pe sector. A1 are cantitate mai mare, iar B5 are calitate mai mare. În acest mod, A1 este înainte pentru că primează cantitatea.',
      },
    ],
  },
  'quantityQuality:byPoints': {
    title: '🔢 După punctaj',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'Toate echipele se ordonează direct după suma punctelor (calitate + cantitate). La egalitate primează cantitatea, apoi calitatea, apoi cel mai mare pește.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 au ambele 6 puncte. A1 are cantitate totală mai mare, deci A1 este înainte chiar dacă media este puțin mai mică.',
      },
    ],
  },
  'quantityQuality:bySectorPositionPerisReversed': {
    title: '🔄 După poziția în sector, primează Calitatea',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'În sector, departajarea rămâne cu prioritate la cantitate. În clasamentul general (în grupele de poziție de sector), departajarea se inversează: primează calitatea, apoi cantitatea.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 au câte 2 puncte și sunt ambele pe locul 1 pe sector. A1 are cantitate mai mare, iar B5 are calitate mai mare. În acest mod, B5 este înainte pentru că la general primează calitatea.',
      },
    ],
  },
  'qualityQuantity:bySectorPosition': {
    title: '📊 După poziția în sector, primează Calitatea',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'Generalul se face pe grupe de poziție de sector. La egalitate primează calitatea și la sector, și la general.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 au câte 2 puncte și sunt ambele pe locul 1 pe sector. B5 are calitate mai bună, deci B5 este înainte chiar dacă A1 are cantitate puțin mai mare.',
      },
    ],
  },
  'qualityQuantity:byPoints': {
    title: '🔢 După punctaj',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'Toate echipele sunt ordonate după total puncte. La egalitate primează calitatea, apoi cantitatea, apoi cel mai mare pește.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 au același total de puncte. B5 are media top N mai mare, deci B5 urcă în clasamentul general.',
      },
    ],
  },
  'qualityQuantity:bySectorPositionPerisReversed': {
    title: '🔄 După poziția în sector, primează Cantitatea',
    sections: [
      {
        heading: 'Cum funcționează',
        body: 'În sector, departajarea rămâne cu prioritate la calitate. În clasamentul general (în grupele de poziție de sector), departajarea se inversează: primează cantitatea, apoi calitatea.',
      },
      {
        heading: 'Exemplu',
        body: 'Standul A1 și Standul B5 au câte 2 puncte și sunt ambele pe locul 1 pe sector. A1 are cantitate mai mare, iar B5 are calitate mai mare. În acest mod, A1 este înainte pentru că la general primează cantitatea.',
      },
    ],
  },
};

export function getGeneralRankingModeExplanation(
  rankingType?: string | null,
  mode?: string | null,
): RankingExplanation | undefined {
  if (!rankingType || !mode) return undefined;
  return GENERAL_RANKING_MODE_EXPLANATIONS[`${rankingType}:${mode}`];
}

/** fish step-ranking.tsx `getMetricIcon`. */
function getMetricIcon(metric: 'quantity' | 'quality'): string {
  return metric === 'quantity' ? '⚖️' : '🐟';
}

/**
 * fish step-ranking.tsx `getGeneralModeGroupExplanation` — the whole «general ranking mode»
 * explanation of a type: «1. 📊 După poziția în sector» with one sub-section per sector mode, then
 * «2. 🔢 După punctaj»; each with «Cum funcționează» and «Exemplu concret». Undefined for a type
 * without a general mode choice.
 */
export function getGeneralModeGroupExplanation(rankingType?: string | null): RankingExplanation | undefined {
  if (!rankingType) return undefined;
  const rankingTypeLabel =
    RANKING_TYPES.find(type => type.value === rankingType)?.label?.replace(/^[^\s]+\s/, '') || rankingType;
  const options = getGeneralRankingOptions(rankingType);
  if (!options.length) return undefined;

  const sectorModeOptions = options.filter(option => option.value !== 'byPoints');
  const byPointsOption = options.find(option => option.value === 'byPoints');

  const buildOptionText = (optionValue: string, fallback: string) => {
    const detailed = getGeneralRankingModeExplanation(rankingType, optionValue);
    if (!detailed) return fallback;
    const howItWorks =
      detailed.sections.find(section => section.heading === 'Cum funcționează')?.body || detailed.sections[0]?.body || fallback;
    const example = detailed.sections.find(section => section.heading === 'Exemplu')?.body;
    return example ? `Cum funcționează:\n${howItWorks}\n\nExemplu concret:\n${example}` : `Cum funcționează:\n${howItWorks}`;
  };

  const sections: ExplanationSection[] = [];
  let majorIndex = 1;

  if (sectorModeOptions.length > 0) {
    const sectorMajorIndex = majorIndex;
    majorIndex += 1;
    sections.push({
      heading: `${sectorMajorIndex}. 📊 După poziția în sector`,
      body: 'Locurile 1 concurează între ele, apoi locurile 2, și așa mai departe.',
    });
    sectorModeOptions.forEach((option, optionIndex) => {
      const metric = getGeneralPriorityMetric(rankingType, option.value as GeneralModeValue);
      sections.push({
        heading: `${sectorMajorIndex}.${optionIndex + 1} ${getMetricIcon(metric)} ${option.label}`,
        body: buildOptionText(option.value, option.description),
      });
    });
  }

  if (byPointsOption) {
    sections.push({
      heading: `${majorIndex}. 🔢 După punctaj`,
      body: buildOptionText(byPointsOption.value, byPointsOption.description),
    });
  }

  return { title: `Cum funcționează departajarea la ${rankingTypeLabel}`, sections };
}

/* ------------------------------------------------------------------ */
/* Grid rule — fish constants/gridRuleExplanation.ts                    */
/* ------------------------------------------------------------------ */

const COMPOSITE_RANKING_TYPES = new Set(['quantityQuality', 'qualityQuantity']);

const RANKING_TYPE_ROMANIAN_NAMES: Record<string, string> = {
  quality: 'Calitate',
  quantityQuality: 'Cantitate/Calitate',
  qualityQuantity: 'Calitate/Cantitate',
};

const COMPOSITE_SCOPE_NOTE =
  'La Cantitate/Calitate și Calitate/Cantitate, regula afectează doar punctajul de calitate — nu și punctajul de cantitate.';

const WHEN_APPLIES_BASE =
  'Regula se aplică exclusiv standurilor fără grilă. Întâi se clasează standurile cu grilă (după calitate), apoi cele fără grilă sunt ordonate între ele cu regula aleasă.';

const EXAMPLE_BASE =
  'Sector cu nrPestiPeSector = 5. Două standuri fără grilă:\n• Stand A: 3 pești, total 2.4 kg (media 0.8 kg)\n• Stand B: 2 pești, total 3.0 kg (media 1.5 kg)\n\nCu "După numărul de capturi": A înaintea lui B (3 > 2 pești).\nCu "După media greutății": B înaintea lui A (1.5 > 0.8 kg).';

const COMPOSITE_EXAMPLE_NOTE =
  'Regula afectează doar punctajul de calitate al acestor standuri. Punctajul de cantitate este calculat separat, după greutatea totală.';

export function getGridRuleExplanation(rankingType: string): RankingExplanation {
  const isComposite = COMPOSITE_RANKING_TYPES.has(rankingType);
  const romanianName = RANKING_TYPE_ROMANIAN_NAMES[rankingType];

  const whenAppliesBody = isComposite ? `${WHEN_APPLIES_BASE}\n\n${COMPOSITE_SCOPE_NOTE}` : WHEN_APPLIES_BASE;

  const exampleHeading = romanianName ? `Exemplu concret — La ${romanianName}` : 'Exemplu concret';
  const exampleBody = isComposite ? `${EXAMPLE_BASE}\n\n${COMPOSITE_EXAMPLE_NOTE}` : EXAMPLE_BASE;

  return {
    title: '🔀 Regula departajare standuri fără grilă',
    sections: [
      {
        heading: 'Ce înseamnă "grilă"?',
        body: 'Grila reprezintă numărul minim de pești stabilit pentru fiecare sector (nrPestiPeSector). Un stand care a prins cel puțin acest număr de pești "are grilă" și este clasat după calitate. Standurile care nu au prins suficienți pești "nu au grilă" și sunt ordonate separat, sub cele cu grilă, folosind regula de mai jos.',
      },
      {
        heading: 'Când se aplică regula',
        body: whenAppliesBody,
      },
      {
        heading: '🐟 După numărul de capturi',
        body: 'Standurile fără grilă sunt ordonate după numărul total de pești prinși. Mai mulți pești = loc mai bun. La egalitate: cantitate totală → cel mai mare pește.',
      },
      {
        heading: '📏 După media greutății',
        body: 'Standurile fără grilă sunt ordonate după media greutății tuturor capturilor (greutate totală / număr capturi). Media mai mare = loc mai bun. La egalitate: cantitate totală → cel mai mare pește.',
      },
      {
        heading: exampleHeading,
        body: exampleBody,
      },
      {
        heading: 'Cazuri speciale',
        body: '• Două standuri fără grilă cu aceleași metrici → împart același loc\n• Standurile fără capturi primesc ultimul loc\n• Regula se aplică independent în fiecare sector',
      },
    ],
  };
}
