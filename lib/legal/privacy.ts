import { OPERATOR, type LegalDocument } from './document';

/*
 * Politica de confidențialitate — written 2026-10-14 from what the apps actually do (a code
 * inventory of fish, fir-intins-cms and bluvi-web). When a data flow changes, change this text in
 * the same task.
 */
export const PRIVACY: LegalDocument = {
  title: 'Politica de confidențialitate',
  description: 'Ce date personale prelucrează Bluvi, de ce, cât timp le păstrăm, cui le transmitem și ce drepturi ai.',
  updated: '14 octombrie 2026',
  updatedIso: '2026-10-14',
  intro: [
    `Bluvi (aplicația mobilă Bluvi și site-ul bluvi.ro) este operat de ${OPERATOR.name}, CUI ${OPERATOR.cui}, nr. Registrul Comerțului ${OPERATOR.regCom}, cu sediul în ${OPERATOR.address} („Bluvi”, „noi”).`,
    'Această politică explică ce date personale prelucrăm când folosești Bluvi, de ce, pe ce temei legal, cât timp le păstrăm, cui le transmitem și ce drepturi ai, conform Regulamentului (UE) 2016/679 („GDPR”) și legislației române.',
  ],
  sections: [
    {
      id: 'operator',
      heading: '1. Cine răspunde de datele tale',
      blocks: [
        `Operatorul datelor este ${OPERATOR.name} Pentru orice întrebare sau cerere privind datele tale ne scrii la ${OPERATOR.email}. Răspundem în cel mult o lună de la primirea cererii.`,
        'Pentru rezervări, administratorul bălții la care rezervi primește datele rezervării și le folosește pentru a o onora; pentru concursuri, organizatorul concursului vede datele înscrierilor. Fiecare dintre ei răspunde de felul în care folosește aceste date în afara Bluvi.',
      ],
    },
    {
      id: 'date',
      heading: '2. Ce date prelucrăm',
      blocks: [
        {
          list: [
            '**Contul tău.** Te autentifici cu Apple, Google sau Facebook. De la furnizor primim numele, adresa de email și poza de profil (iar de la Apple un identificator al contului). Păstrăm numele de utilizator, emailul, poza de profil, opțional telefonul și o scurtă descriere, data creării contului și data ultimei activități.',
            '**Ce publici.** Partide (sesiuni de pescuit) cu capturile lor: specie, greutate, momeală, fotografii, note, persoanele etichetate și punctele de pe hartă alese de tine; recenzii despre bălți; mesaje, fotografii și reacții în chatul concursurilor; voturi în sondaje; persoanele pe care le urmărești.',
            '**Concursuri.** Înscrierile (participanți, numele echipei sau al invitaților, clubul), standul alocat, cântăririle și capturile, penalizările, clasamentul și, la cântărire, semnăturile arbitrului și ale martorului. Dacă organizezi un concurs: datele concursului, arbitrii și numărul tău de telefon.',
            '**Rezervări.** Balta, standul și perioada, numele și telefonul de contact, mențiunile tale, prețul afișat și starea rezervării. Administratorul bălții poate marca o neprezentare (cu un comentariu) și te poate evalua după rezervare.',
            '**Locația.** Doar cu permisiunea ta și doar cât folosești aplicația (niciodată în fundal), pentru a-ți arăta bălțile din apropiere și distanța până la ele. Coordonatele sunt trimise serverului doar pentru acea căutare și nu le stocăm. Punctele pe care le alegi tu pe hartă într-o partidă (loc, capturi, marcaje) sunt salvate în partidă.',
            '**Dispozitivul.** Tokenul pentru notificări push, platforma și versiunea aplicației, un identificator aleator al instalării (pentru alegerile tale de confidențialitate) și, când ne trimiți feedback, detaliile tehnice ale dispozitivului (model, sistem de operare, memorie).',
            '**Comunicarea cu noi.** Ce ne scrii în feedback, cererile de adăugare a unei bălți, de revendicare a unei bălți sau de cont de organizator, împreună cu datele de contact pe care ni le dai.',
            '**Date tehnice.** Jurnale de server (adresa IP, data, adresa cerută), rapoarte de erori și, cu acordul tău, statistici de utilizare (vezi secțiunea 6).',
          ],
        },
        'Nu cerem și nu prelucrăm date despre sănătate, opinii politice sau alte categorii speciale de date. Nu facem decizii automate cu efecte juridice asupra ta.',
      ],
    },
    {
      id: 'scopuri',
      heading: '3. De ce și pe ce temei',
      blocks: [
        {
          list: [
            '**Să-ți oferim serviciul** (contul, partidele, concursurile, rezervările, chatul, notificările, ștergerea contului) — executarea contractului cu tine, art. 6 alin. (1) lit. (b) GDPR.',
            '**Siguranța și buna funcționare** (prevenirea abuzurilor, securitate, jurnale de server, rapoarte de erori, păstrarea rezultatelor concursurilor, reputația pescarilor față de bălți) — interesul nostru legitim, art. 6 alin. (1) lit. (f).',
            '**Statistici de utilizare și cookie-uri neesențiale** — consimțământul tău, art. 6 alin. (1) lit. (a), pe care îl poți retrage oricând.',
            '**Locația dispozitivului și notificările push** — permisiunea pe care o dai în sistemul telefonului; o poți retrage oricând din setările telefonului.',
            '**Obligații legale** (de exemplu răspunsul la solicitările autorităților sau păstrarea documentelor contabile, dacă va fi cazul) — art. 6 alin. (1) lit. (c).',
          ],
        },
      ],
    },
    {
      id: 'public',
      heading: '4. Ce văd ceilalți',
      blocks: [
        {
          list: [
            '**Oricine** (inclusiv pe site, fără cont): numele de utilizator și poza ta, descrierea, partidele, capturile și concursurile din profil (poți ascunde o partidă din profil), recenziile tale despre bălți, rezultatele concursurilor la care participi, cântăririle (inclusiv semnăturile de la cântărire) și reputația ta de pescar (evaluările primite de la bălți și numărul de neprezentări).',
            '**Participanții la o partidă**: detaliile partidei, inclusiv punctele de pe hartă.',
            '**Participanții la un concurs**: mesajele din chatul concursului, cu numele și poza ta.',
            '**Organizatorul unui concurs**: înscrierile, standurile și datele de contact ale participanților. Telefonul organizatorului și al arbitrilor apare pe pagina concursului.',
            '**Administratorul unei bălți**: rezervările tale la acea baltă (nume, telefon, mențiuni) și istoricul de prezență.',
          ],
        },
      ],
    },
    {
      id: 'destinatari',
      heading: '5. Cui transmitem datele',
      blocks: [
        'Nu vindem datele tale și nu le folosim pentru reclame. Le transmitem doar furnizorilor care ne ajută să rulăm Bluvi, pe baza unor contracte care îi obligă să le protejeze, și doar cât le trebuie:',
        {
          list: [
            'Google (Firebase: autentificarea chatului, baza de date a chatului și a partidelor live, notificări push, statistici de utilizare și rapoarte de erori din aplicație; Google Analytics pe site; Google Maps în aplicația Android);',
            'Amazon Web Services (stocarea fotografiilor, în regiunea Frankfurt);',
            'DigitalOcean (serverele Bluvi), Cloudflare (rețeaua de livrare a conținutului și protecție) și Vercel (site-ul, în regiunea Frankfurt);',
            'Sentry (rapoarte de erori), Postmark (emailuri despre rezervări și concursuri), Better Stack (jurnale de server) și Expo (actualizările aplicației);',
            'Apple, Google și Meta (Facebook), doar pentru autentificare, când alegi să te conectezi cu ei;',
            'furnizorii de hărți (Apple Maps, Google Maps, OpenFreeMap, Esri), care primesc adresa IP când afișează harta;',
            'administratorii bălților și organizatorii concursurilor, pentru rezervări și înscrieri, cum e descris mai sus;',
            'autoritățile, doar când legea ne obligă.',
          ],
        },
      ],
    },
    {
      id: 'transferuri',
      heading: '6. Transferuri în afara Uniunii Europene',
      blocks: [
        'Unii furnizori (de exemplu Google, Sentry, Postmark, Meta) pot prelucra date în Statele Unite sau în alte țări din afara Spațiului Economic European. În aceste cazuri transferul se face pe baza Cadrului UE–SUA privind protecția datelor, a clauzelor contractuale standard aprobate de Comisia Europeană sau a altor garanții prevăzute de GDPR.',
      ],
    },
    {
      id: 'cookie',
      heading: '7. Cookie-uri și statistici',
      blocks: [
        'Pe site folosim cookie-uri strict necesare (sesiunea de autentificare și alegerile tale de confidențialitate) și, doar dacă le accepți, Google Analytics și monitorizarea erorilor. Lista completă și alegerile tale sunt pe pagina „Setări de confidențialitate” (bluvi.ro/cookie-uri).',
        'În aplicație, alegerile de confidențialitate sunt în Setări. Statisticile de utilizare nu folosesc identificatorul de publicitate al telefonului și nu te urmărim în alte aplicații.',
      ],
    },
    {
      id: 'pastrare',
      heading: '8. Cât timp păstrăm datele',
      blocks: [
        {
          list: [
            'Datele contului, cât timp ai cont. La ștergerea contului, numele, emailul, telefonul și poza sunt șterse sau înlocuite cu un nume anonim („Deleted User”), iar tokenurile de notificare sunt șterse.',
            'Rezultatele concursurilor, cântăririle, rezervările și recenziile rămân după ștergerea contului, fără numele tău, pentru că fac parte din istoricul concursurilor și al bălților; mesajele trimise în chatul unui concurs rămân în conversație.',
            'Ciornele de concurs nefolosite 30 de zile, tokenurile de notificare nefolosite 270 de zile și datele interne despre notificările de urmărire (30–180 de zile) se șterg automat.',
            'Cookie-urile: sesiunea 1 an, alegerile de confidențialitate 180 de zile, Google Analytics 2 ani (doar cu acordul tău).',
          ],
        },
      ],
    },
    {
      id: 'drepturi',
      heading: '9. Drepturile tale',
      blocks: [
        'Ai dreptul să ceri acces la datele tale, rectificarea lor, ștergerea lor, restricționarea prelucrării, portabilitatea datelor și să te opui prelucrării bazate pe interesul nostru legitim. Când prelucrarea se bazează pe consimțământ, îl poți retrage oricând, fără să afecteze prelucrarea de până atunci.',
        `Îți poți modifica profilul și îți poți șterge contul direct din Setări (în aplicație sau pe site). Pentru orice altă cerere scrie-ne la ${OPERATOR.email}.`,
        'Dacă crezi că îți prelucrăm datele cu încălcarea legii, poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), www.dataprotection.ro.',
      ],
    },
    {
      id: 'minori',
      heading: '10. Minori',
      blocks: [
        'Bluvi este destinat persoanelor de cel puțin 16 ani. Nu creăm cu bună știință conturi pentru copii sub 16 ani; dacă afli că un copil sub 16 ani și-a făcut cont, scrie-ne și îl ștergem.',
      ],
    },
    {
      id: 'securitate',
      heading: '11. Securitate',
      blocks: [
        'Folosim conexiuni criptate (HTTPS), acces restricționat la date și furnizori cu standarde recunoscute de securitate. Fotografiile pe care le publici sunt accesibile oricui are adresa lor. Nicio metodă de transmitere sau stocare nu este complet sigură; dacă apare o încălcare a securității datelor care te afectează, te anunțăm conform legii.',
      ],
    },
    {
      id: 'modificari',
      heading: '12. Modificări',
      blocks: [
        'Putem actualiza această politică când Bluvi se schimbă. Data ultimei actualizări este în partea de sus a paginii; despre schimbările importante te anunțăm în aplicație sau pe email.',
      ],
    },
  ],
};
