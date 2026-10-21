import { OPERATOR, type LegalDocument } from './document';

/*
 * Politica de confidențialitate — written 2026-10-14 from what the apps actually do (a code
 * inventory of fish, fir-intins-cms and bluvi-web); 2026-10-21 gaps against Meta / Strava (chat
 * reports, review auto-hide, feed order, copies by others, business transfer, backups); 2026-10-20 extended for app 3.8.0 (feed,
 * povești, video through Mux, Live Activities, raportare / blocare / moderare, recomandări) —
 * a draft for the lawyer's review. When a data flow changes, change this text in the same task.
 */
export const PRIVACY: LegalDocument = {
  title: 'Politica de confidențialitate',
  description: 'Ce date personale prelucrează Bluvi, de ce, cât timp le păstrăm, cui le transmitem și ce drepturi ai.',
  updated: '21 octombrie 2026',
  updatedIso: '2026-10-21',
  intro: [
    `Bluvi (aplicația mobilă Bluvi și site-ul bluvi.ro) este operat de ${OPERATOR.name}, CUI ${OPERATOR.cui}, nr. Registrul Comerțului ${OPERATOR.regCom}, cu sediul în ${OPERATOR.address} („Bluvi”, „noi”).`,
    'Această politică explică ce date personale prelucrăm când folosești Bluvi, de ce, pe ce temei legal, cât timp le păstrăm, cui le transmitem și ce drepturi ai, conform Regulamentului (UE) 2016/679 („GDPR”) și legislației române.',
    '**Ce s-a schimbat (21 octombrie 2026).** Am adăugat raportarea și blocarea din chatul concursurilor, ascunderea automată a unei recenzii după trei raportări, ordinea feed-ului, ce se întâmplă cu datele la o eventuală vânzare a Bluvi și cât timp rămân datele în copiile de siguranță.',
    '**20 octombrie 2026.** Am adăugat:',
    {
      list: [
        'postările din feed (text, fotografii, videoclipuri cu sunet, capturi, balta sau apa, mențiuni), comentariile, răspunsurile și aprecierile;',
        'poveștile (vizibile 24 de ore), lista celor care le-au văzut, pe care o vede autorul, și reacțiile;',
        'raportarea, blocarea și moderarea conținutului și cât timp păstrăm aceste date;',
        'recomandările de pescari („Pescari sugerați”, „Descoperă pescari”) și cum te poți opune lor;',
        'Live Activities și notificarea permanentă de concurs (ce apare pe ecranul de blocare);',
        'permisiunea pentru microfon, găzduirea videoclipurilor la Mux, formatarea textelor cu Google Gemini și notificările Apple (APNs);',
        'statisticile de utilizare din aplicație, care devin opționale, și ce se întâmplă cu datele noi când îți ștergi contul.',
      ],
    },
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
            '**Ce publici.** Partide (sesiuni de pescuit) cu capturile lor: specie, greutate, momeală, fotografii, note, persoanele etichetate și punctele de pe hartă alese de tine; recenzii despre bălți, cu fotografiile, comentariile și reacțiile lor; mesaje, fotografii și reacții în chatul concursurilor; voturi în sondaje; persoanele pe care le urmărești.',
            '**Postări în feed.** Textul postării, fotografiile și videoclipurile (inclusiv sunetul înregistrat în ele), datele capturii pe care le completezi (specie, greutate, lungime), balta sau apa publică pe care o alegi, legătura cu o partidă și persoanele pe care le menționezi (@nume). Videoclipurile au cel mult 60 de secunde.',
            '**Comentarii și aprecieri.** Comentariile și răspunsurile tale la postări, aprecierile date postărilor și comentariilor.',
            '**Povești.** Fotografia sau videoclipul (cel mult 15 secunde, cu sunet), textele și etichetele adăugate peste ele (de exemplu captura sau balta). Când vezi povestea altcuiva fiind conectat, înregistrăm că ai văzut-o și reacția ta, dacă reacționezi.',
            '**Mențiuni.** Dacă un alt pescar te menționează într-o postare sau într-un comentariu, salvăm numele tău de utilizator și legătura cu profilul tău în acel conținut.',
            '**Raportări și blocări.** Când raportezi un conținut (inclusiv un mesaj din chatul unui concurs): cine raportează, motivul, nota ta și o copie a conținutului raportat la momentul raportării (pentru un mesaj din chat: textul, fotografiile, mesajul la care răspundea, autorul și concursul). Lista utilizatorilor pe care i-ai blocat. Dacă un cont este suspendat: data și motivul suspendării.',
            '**Concursuri.** Înscrierile (participanți, numele echipei sau al invitaților, clubul), standul alocat, cântăririle și capturile, penalizările, clasamentul și, la cântărire, semnăturile arbitrului și ale martorului. Dacă organizezi un concurs: datele concursului, arbitrii și numărul tău de telefon.',
            '**Live Activities și notificarea de concurs.** Când participi la un concurs sau alegi „Urmărește live”, telefonul ne transmite identificatori tehnici pentru actualizarea cardului de pe ecranul de blocare (tokenuri Apple pentru Live Activities pe iPhone, tokenul de notificări pe Android), versiunea aplicației și alegerea ta de a urmări concursul. Păstrăm și ultima stare trimisă cardului (loc, greutate, mesajul afișat), ca să nu trimitem de două ori aceeași actualizare.',
            '**Rezervări.** Balta, standul și perioada, numele și telefonul de contact, mențiunile tale, prețul afișat și starea rezervării. Administratorul bălții poate marca o neprezentare (cu un comentariu) și te poate evalua după rezervare.',
            '**Locația.** Doar cu permisiunea ta și doar cât folosești aplicația (niciodată în fundal), pentru a-ți arăta bălțile din apropiere și distanța până la ele. Coordonatele sunt trimise serverului doar pentru acea căutare și nu le stocăm. Punctele pe care le alegi tu pe hartă într-o partidă (loc, capturi, marcaje) sunt salvate în partidă. Balta sau apa pe care o alegi la o postare sau poveste este conținut publicat de tine, nu locația telefonului.',
            '**Camera, fotografiile și microfonul.** Cu permisiunea ta, aplicația folosește camera și galeria pentru fotografiile și videoclipurile pe care alegi să le publici, iar microfonul doar cât înregistrezi un videoclip, ca să-i păstreze sunetul. Nu accesăm microfonul în alte situații și nu încărcăm nimic din galerie fără să alegi tu.',
            '**Dispozitivul.** Tokenul pentru notificări push, platforma și versiunea aplicației, un identificator aleator al instalării (pentru alegerile tale de confidențialitate) și, când ne trimiți feedback, detaliile tehnice ale dispozitivului (model, sistem de operare, memorie).',
            '**Comunicarea cu noi.** Ce ne scrii în feedback, cererile de adăugare a unei bălți, de revendicare a unei bălți sau de cont de organizator, sesizările și contestațiile trimise pe email, împreună cu datele de contact pe care ni le dai.',
            '**Date tehnice.** Jurnale de server (adresa IP, data, adresa cerută), rapoarte de erori și, cu acordul tău, statistici de utilizare (vezi secțiunea 10).',
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
            '**Să-ți oferim serviciul** (contul, partidele, postările, poveștile, comentariile, aprecierile, mențiunile, concursurile, rezervările, chatul, notificările, Live Activities, blocarea utilizatorilor, ștergerea contului) — executarea contractului cu tine, art. 6 alin. (1) lit. (b) GDPR.',
            '**Siguranța și buna funcționare** (prevenirea abuzurilor, securitate, jurnale de server, rapoarte de erori, păstrarea rezultatelor concursurilor, reputația pescarilor față de bălți) — interesul nostru legitim, art. 6 alin. (1) lit. (f).',
            '**Raportări și moderare** (analiza raportărilor, ascunderea conținutului, suspendarea conturilor, informarea celor implicați, contestațiile și evidența deciziilor) — obligațiile noastre din Regulamentul (UE) 2022/2065 privind serviciile digitale („DSA”), art. 6 alin. (1) lit. (c) GDPR, și interesul nostru legitim de a păstra Bluvi sigur, lit. (f).',
            '**Recomandări de pescari** („Pescari sugerați”, „Descoperă pescari”) — interesul nostru legitim de a te ajuta să găsești pescari cu care ai legătură, lit. (f). Te poți opune (vezi secțiunea 5).',
            '**Formatarea textelor cu AI**, doar când apeși tu butonul de formatare automată — executarea contractului, lit. (b).',
            '**Statistici de utilizare și cookie-uri neesențiale** — consimțământul tău, art. 6 alin. (1) lit. (a), pe care îl poți retrage oricând.',
            '**Locația dispozitivului, camera, galeria, microfonul, notificările push și Live Activities** — permisiunea pe care o dai în sistemul telefonului; o poți retrage oricând din setările telefonului.',
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
            '**Postările, comentariile și aprecierile.** Postările tale (cu fotografiile, videoclipurile, datele capturii, balta sau apa și mențiunile) și comentariile tale sunt publice: apar în aplicație, în feed și pe pagini ale site-ului (de exemplu bluvi.ro/postari), cu numele și poza ta, și pot fi găsite de motoarele de căutare și distribuite prin link. Pentru aprecieri afișăm numărul lor.',
            '**Poveștile** sunt vizibile oricui timp de 24 de ore. **Autorul unei povești vede cine a văzut-o (dintre utilizatorii conectați) și cum a reacționat.** Așadar, când vezi povestea cuiva, acel pescar vede numele și poza ta în lista de vizualizări.',
            '**Utilizatorii conectați** pot căuta profilul tău după numele de utilizator, pot vedea pe cine urmărești și cine te urmărește și te pot menționa în postări și comentarii.',
            '**Utilizatorii pe care i-ai blocat** nu îți mai văd conținutul în feed, iar tu nu îl mai vezi pe al lor, nici mesajele lor din chatul concursurilor. Blocarea anulează și urmărirea reciprocă. Persoana blocată nu este anunțată.',
            '**Copii făcute de alții.** Ce publici public poate fi văzut, salvat prin captură de ecran sau distribuit mai departe de alte persoane, în afara Bluvi. Când ștergi un conținut îl scoatem din Bluvi, dar nu putem controla copiile făcute de alții.',
            '**Persoana pe care o raportezi** nu află cine a raportat-o. Raportările le văd doar administratorii Bluvi care moderează conținutul.',
            '**Participanții la o partidă**: detaliile partidei, inclusiv punctele de pe hartă.',
            '**Participanții la un concurs**: mesajele din chatul concursului, cu numele și poza ta.',
            '**Cine ține telefonul tău în mână**: cardul de concurs de pe ecranul de blocare (Live Activity pe iPhone, notificarea permanentă pe Android) arată, fără deblocare, numele concursului, locul și greutatea ta și, pe cardul unui concurs urmărit, numele liderului. Îl poți opri din setările telefonului sau glisându-l.',
            '**Organizatorul unui concurs**: înscrierile, standurile și datele de contact ale participanților. Telefonul organizatorului și al arbitrilor apare pe pagina concursului.',
            '**Administratorul unei bălți**: rezervările tale la acea baltă (nume, telefon, mențiuni) și istoricul de prezență.',
          ],
        },
      ],
    },
    {
      id: 'recomandari',
      heading: '5. Recomandări de pescari',
      blocks: [
        '**Pescari sugerați.** Îți propunem pescari pe care i-ai putea urmări, pe baza activității comune din ultimele 12 luni: aceeași echipă, club sau concurs, aceeași partidă, aceleași bălți sau prieteni comuni pe care îi urmăriți. Și profilul tău poate fi propus altor pescari pe aceleași criterii. Ordinea se schimbă periodic.',
        '**Descoperă pescari.** Profilul tău poate fi găsit după numele de utilizator. În lista „Activi recent” pot apărea momentul ultimei tale partide publice și balta unde a avut loc, iar în „Urmăriți de prietenii tăi”, faptul că te urmăresc persoane pe care le urmărește și cel care caută.',
        '**Ordinea feed-ului.** Feed-ul este cronologic; când ești conectat, postările pescarilor pe care îi urmărești sunt urcate cu câteva ore. Nu ordonăm feed-ul după un profil al intereselor tale și nu afișăm conținut plătit.',
        `Recomandările folosesc doar informații care sunt deja publice sau pe care le ai în comun cu celălalt pescar și nu au efecte juridice sau asemănătoare asupra ta. Poți ascunde o sugestie din aplicație. Dacă nu vrei ca profilul tău să fie propus altora, scrie-ne la ${OPERATOR.email} și îl excludem din recomandări; poți face oricând opoziție, conform art. 21 GDPR.`,
      ],
    },
    {
      id: 'moderare',
      heading: '6. Raportări, blocări și moderare',
      blocks: [
        `Poți raporta din aplicație postări, comentarii, povești, recenzii și mesaje din chatul concursurilor, iar oricine (inclusiv fără cont) ne poate sesiza un conținut la ${OPERATOR.email}. Raportările sunt analizate de administratorii Bluvi, care pot ascunde conținutul sau suspenda contul autorului, cum e descris în Termeni și condiții. Nu filtrăm automat conținutul înainte de publicare. Singura regulă automată: o recenzie sau un comentariu la o recenzie raportat de trei utilizatori diferiți este ascuns până la verificarea unui administrator; autorul primește motivarea pe email și poate contesta.`,
        'Un mesaj din chat ascuns de moderare rămâne stocat, cu fotografiile lui, ca dovadă, cât timp este ascuns, și apare celorlalți ca „Mesaj ascuns de moderare”; citatul lui din răspunsuri este și el ascuns.',
        'Pentru fiecare decizie păstrăm o evidență: cine a decis, ce măsură, motivul, raportările legate de ea și o copie a conținutului la acel moment, ca dovadă în caz de contestație sau de solicitare a autorităților. O poveste sau un videoclip raportat nu se șterge cât timp raportarea este deschisă, chiar dacă cele 24 de ore ale poveștii au trecut.',
        `Dacă îți suspendăm contul, nu te mai poți autentifica și deci nu îți mai poți șterge contul din aplicație: scrie-ne la ${OPERATOR.email} și îl ștergem noi, cu excepțiile din secțiunea 11.`,
      ],
    },
    {
      id: 'live',
      heading: '7. Live Activities și notificări',
      blocks: [
        'Notificările push și cardurile de concurs de pe ecranul de blocare funcționează doar dacă le permiți în setările telefonului. Pe iPhone, actualizările sunt livrate prin serviciul Apple Push Notification (APNs), iar pe Android prin Firebase Cloud Messaging (Google). Furnizorii primesc tokenul dispozitivului și conținutul actualizării (de exemplu locul și greutatea din clasament).',
        'Informațiile de pe card sunt orientative; clasamentul oficial este cel din pagina concursului. Cardul unui concurs încheiat dispare după câteva ore.',
      ],
    },
    {
      id: 'destinatari',
      heading: '8. Cui transmitem datele',
      blocks: [
        'Nu vindem datele tale și nu le folosim pentru reclame. Le transmitem doar furnizorilor care ne ajută să rulăm Bluvi, pe baza unor contracte care îi obligă să le protejeze, și doar cât le trebuie:',
        {
          list: [
            'Google (Firebase: autentificarea chatului, baza de date a chatului și a partidelor live, notificări push, statistici de utilizare și rapoarte de erori din aplicație; Google Analytics pe site; Google Maps în aplicația Android);',
            'Google (Gemini API), doar textul pe care ceri să fie formatat automat (de exemplu descrierea unui concurs), fără alte date despre tine;',
            'Mux, Inc. (SUA), care primește videoclipurile încărcate de tine, le procesează, le stochează și le livrează celor care le privesc; Mux vede adresa IP a celor care redau videoclipul;',
            'Apple (Apple Push Notification service), pentru notificările și Live Activities pe iPhone;',
            'Amazon Web Services (stocarea fotografiilor, în regiunea Frankfurt);',
            'DigitalOcean (serverele Bluvi), Cloudflare (rețeaua de livrare a conținutului și protecție) și Vercel (site-ul, în regiunea Frankfurt);',
            'Sentry (rapoarte de erori), Postmark (emailuri despre rezervări, concursuri și moderare), Better Stack (jurnale de server) și Expo (actualizările aplicației);',
            'Apple, Google și Meta (Facebook), doar pentru autentificare, când alegi să te conectezi cu ei;',
            'furnizorii de hărți (Apple Maps, Google Maps, OpenFreeMap, Esri), care primesc adresa IP când afișează harta;',
            'administratorii bălților și organizatorii concursurilor, pentru rezervări și înscrieri, cum e descris mai sus;',
            'autoritățile, doar când legea ne obligă;',
            'un eventual cumpărător sau succesor, dacă Bluvi este vândut sau reorganizat; acesta va prelua datele cu aceleași obligații, iar noi te anunțăm înainte.',
          ],
        },
      ],
    },
    {
      id: 'transferuri',
      heading: '9. Transferuri în afara Uniunii Europene',
      blocks: [
        'Unii furnizori (de exemplu Google, inclusiv Gemini API, Mux, Apple, Sentry, Postmark, Meta) pot prelucra date în Statele Unite sau în alte țări din afara Spațiului Economic European. În aceste cazuri transferul se face pe baza Cadrului UE–SUA privind protecția datelor, a clauzelor contractuale standard aprobate de Comisia Europeană sau a altor garanții prevăzute de GDPR.',
        'Pentru Mux, Inc. transferul se bazează pe certificarea în Cadrul UE–SUA privind protecția datelor sau, în lipsa ei, pe clauzele contractuale standard din acordul de prelucrare a datelor încheiat cu Mux [de verificat]. Pentru Gemini API folosim condițiile în care Google nu folosește textele trimise pentru a-și antrena modelele [de verificat].',
      ],
    },
    {
      id: 'cookie',
      heading: '10. Cookie-uri și statistici',
      blocks: [
        'Pe site folosim cookie-uri strict necesare (sesiunea de autentificare și alegerile tale de confidențialitate) și, doar dacă le accepți, Google Analytics și monitorizarea erorilor. Lista completă și alegerile tale sunt pe pagina „Setări de confidențialitate” (bluvi.ro/cookie-uri).',
        'În aplicație, statisticile de utilizare (Google Analytics for Firebase) sunt opționale și se bazează pe consimțământul tău, pe care îl dai sau îl retragi din Setări, „Setări de confidențialitate”. Semnalele de publicitate către Google sunt trimise întotdeauna ca refuzate. Statisticile nu folosesc identificatorul de publicitate al telefonului și nu te urmărim în alte aplicații.',
      ],
    },
    {
      id: 'pastrare',
      heading: '11. Cât timp păstrăm datele',
      blocks: [
        {
          list: [
            'Datele contului, cât timp ai cont. La ștergerea contului, numele, emailul, telefonul și poza sunt șterse sau înlocuite cu un nume anonim („Deleted User”), iar tokenurile de notificare sunt șterse.',
            'Postările, comentariile, aprecierile și poveștile, până le ștergi tu sau până îți ștergi contul. La ștergerea contului ștergem postările tale (cu fotografiile și videoclipurile încărcate de tine), comentariile tale și răspunsurile din firele începute de tine, aprecierile, poveștile, vizualizările și reacțiile tale, blocările (date sau primite), tokenurile și urmăririle pentru Live Activities, mențiunile tale din conținutul altora și raportările făcute despre conținutul tău.',
            'Poveștile se șterg automat, de regulă în ora de după expirarea celor 24 de ore, împreună cu lista de vizualizări și reacțiile; o poveste raportată se păstrează până se închide raportarea.',
            'Videoclipurile se șterg de la Mux, de regulă în câteva ore după ce postarea sau povestea lor a fost ștearsă, cu excepția celor care fac obiectul unei raportări deschise. Videoclipurile încărcate dar nepublicate se șterg după 24 de ore.',
            'Raportările se păstrează 12 luni de la soluționare, iar evidența deciziilor de moderare (inclusiv copia conținutului) 12 luni de la decizie, cu excepția cazului în care legea ne obligă să le păstrăm mai mult sau sunt necesare pentru un litigiu ori o solicitare a autorităților în curs. Raportările făcute de tine rămân în această perioadă și după ștergerea contului, legate de contul anonim.',
            'Datele pentru Live Activities: tokenurile se șterg la 7 zile după încheierea cardului sau după 30 de zile în care nu au fost folosite, alegerea „Urmărește live” după 14 zile, iar stările trimise cardurilor după 7–14 zile.',
            'Rezultatele concursurilor, cântăririle, rezervările și recenziile (cu fotografiile, comentariile și reacțiile lor) rămân după ștergerea contului, fără numele tău, pentru că fac parte din istoricul concursurilor și al bălților; mesajele trimise în chatul unui concurs rămân în conversație.',
            'Ciornele de concurs nefolosite 30 de zile, tokenurile de notificare nefolosite 270 de zile și datele interne despre notificările de urmărire (30–180 de zile) se șterg automat.',
            'Copiile de siguranță ale bazei de date se păstrează cel mult [de verificat: 30] de zile; datele șterse dispar din ele odată cu rotirea copiilor.',
            'Cookie-urile: sesiunea 1 an, alegerile de confidențialitate 180 de zile, Google Analytics 2 ani (doar cu acordul tău).',
          ],
        },
      ],
    },
    {
      id: 'drepturi',
      heading: '12. Drepturile tale',
      blocks: [
        'Ai dreptul să ceri acces la datele tale, rectificarea lor, ștergerea lor, restricționarea prelucrării, portabilitatea datelor și să te opui prelucrării bazate pe interesul nostru legitim (de exemplu recomandărilor de pescari). Când prelucrarea se bazează pe consimțământ, îl poți retrage oricând, fără să afecteze prelucrarea de până atunci.',
        `Îți poți modifica profilul, îți poți șterge postările, comentariile și poveștile și îți poți șterge contul direct din aplicație sau de pe site. Pentru orice altă cerere, inclusiv dacă ai fost menționat sau apari într-un conținut publicat de altcineva, ori dacă ai un cont suspendat și vrei să-l ștergi, scrie-ne la ${OPERATOR.email}.`,
        'Dacă crezi că îți prelucrăm datele cu încălcarea legii, poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), www.dataprotection.ro.',
      ],
    },
    {
      id: 'minori',
      heading: '13. Minori',
      blocks: [
        'Bluvi este destinat persoanelor de cel puțin 16 ani. Nu creăm cu bună știință conturi pentru copii sub 16 ani; dacă afli că un copil sub 16 ani și-a făcut cont, scrie-ne și îl ștergem. Nu publica imagini cu minori fără acordul părintelui sau al tutorelui lor.',
      ],
    },
    {
      id: 'securitate',
      heading: '14. Securitate',
      blocks: [
        'Folosim conexiuni criptate (HTTPS), acces restricționat la date și furnizori cu standarde recunoscute de securitate. Fotografiile și videoclipurile pe care le publici sunt accesibile oricui are adresa lor. Nicio metodă de transmitere sau stocare nu este complet sigură; dacă apare o încălcare a securității datelor care te afectează, te anunțăm conform legii.',
      ],
    },
    {
      id: 'modificari',
      heading: '15. Modificări',
      blocks: [
        'Putem actualiza această politică când Bluvi se schimbă. Data ultimei actualizări și un rezumat al schimbărilor sunt în partea de sus a paginii; despre schimbările importante te anunțăm în aplicație sau pe email.',
      ],
    },
  ],
};
