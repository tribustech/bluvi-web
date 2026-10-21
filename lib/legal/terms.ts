import { OPERATOR, type LegalDocument } from './document';

/*
 * Termeni și condiții — written 2026-10-14 for what Bluvi offers today (no payments through Bluvi);
 * 2026-10-20 extended for app 3.8.0: user content (feed, povești, video), its rules, reporting and
 * moderation under Regulation (EU) 2022/2065 (DSA arts. 11–17, 20) and Live Activities — a draft for
 * the lawyer's review. 2026-10-21: gaps against Instagram / Meta / Strava terms (chat reports, the
 * review auto-hide, feed order, outdoor safety, app stores, final clauses).
 */
export const TERMS: LegalDocument = {
  title: 'Termeni și condiții',
  description: 'Regulile de folosire a aplicației Bluvi și a site-ului bluvi.ro: contul, conținutul tău, raportarea și moderarea, concursuri, rezervări și răspunderea.',
  updated: '21 octombrie 2026',
  updatedIso: '2026-10-21',
  intro: [
    `Acești termeni se aplică aplicației mobile Bluvi și site-ului bluvi.ro („Bluvi”), operate de ${OPERATOR.name}, CUI ${OPERATOR.cui}, nr. Registrul Comerțului ${OPERATOR.regCom}, cu sediul în ${OPERATOR.address} („noi”).`,
    'Când îți creezi cont sau folosești Bluvi accepți acești termeni. Dacă nu ești de acord cu ei, te rugăm să nu folosești Bluvi. Felul în care prelucrăm datele tale este descris în Politica de confidențialitate.',
    '**Ce s-a schimbat (21 octombrie 2026).** Am adăugat:',
    {
      list: [
        'raportarea și blocarea direct din chatul concursurilor și ascunderea automată a unei recenzii după trei raportări (secțiunile 5 și 6);',
        'cum ordonăm feed-ul (secțiunea 7), siguranța la pescuit (secțiunea 13) și magazinele de aplicații (secțiunea 17);',
        'sugestiile pe care ni le trimiți, preavizul pentru modificări și clauzele finale (secțiunile 15, 20 și 22).',
      ],
    },
    '**20 octombrie 2026.** Am adăugat:',
    {
      list: [
        'regulile pentru conținutul publicat de utilizatori (postări, comentarii, povești, videoclipuri) și licența pe care ne-o acorzi (secțiunile 3 și 4);',
        'cum poți raporta un conținut, inclusiv fără cont, și ce trebuie să cuprindă o sesizare (secțiunea 5);',
        'cum moderăm, cum te anunțăm și cum poți contesta o decizie (secțiunile 6 și 8);',
        'punctul de contact pentru utilizatori și autorități (secțiunea 9);',
        'Live Activities și notificarea de concurs, cu caracter orientativ (secțiunea 10).',
      ],
    },
  ],
  sections: [
    {
      id: 'serviciul',
      heading: '1. Ce este Bluvi',
      blocks: [
        'Bluvi este o platformă pentru pescari: descoperi bălți și ape publice, ții evidența partidelor și a capturilor, publici postări și povești cu fotografii și videoclipuri, comentezi și apreciezi, participi la concursuri sau le organizezi și le urmărești live, rezervi standuri la bălțile care primesc rezervări, lași recenzii și urmărești alți pescari. Poți bloca utilizatori și raporta conținut.',
        'Folosirea Bluvi este gratuită. În prezent nu încasăm plăți prin Bluvi: prețul unei rezervări se plătește direct bălții, iar taxa de participare la un concurs, direct organizatorului.',
      ],
    },
    {
      id: 'cont',
      heading: '2. Contul tău',
      blocks: [
        {
          list: [
            'Trebuie să ai cel puțin 16 ani ca să îți faci cont.',
            'Te autentifici cu Apple, Google sau Facebook; ești responsabil pentru accesul la acel cont și la telefonul tău.',
            'Datele din profil (numele de utilizator, telefonul) trebuie să fie reale și să nu imite o altă persoană sau o organizație. Putem schimba un nume de utilizator care imită pe cineva, încalcă o marcă sau induce în eroare, și te anunțăm.',
            'Contul este personal: nu îl poți vinde, închiria sau transfera altcuiva.',
            'Îți poți șterge oricând contul din Setări. Ce se întâmplă cu datele tale este descris în Politica de confidențialitate.',
          ],
        },
      ],
    },
    {
      id: 'continut',
      heading: '3. Conținutul tău',
      blocks: [
        '**Ce înseamnă „conținutul utilizatorului”.** Tot ce publici în Bluvi: postări, povești, fotografii, videoclipuri (cu sunetul lor), texte, comentarii și răspunsuri, reacții și aprecieri, mențiuni, partide și capturi, recenzii, mesaje în chatul concursurilor, voturi și descrierea profilului.',
        '**Rămâi proprietarul lui.** Ne acorzi o licență neexclusivă, gratuită (fără redevențe), valabilă în toată lumea, să găzduim, să stocăm, să reproducem, să adaptăm tehnic (de exemplu redimensionare, conversie video, miniaturi), să afișăm și să distribuim conținutul tău în aplicația Bluvi și pe bluvi.ro, inclusiv prin linkurile de distribuire, pentru a opera, afișa și promova serviciul în interiorul Bluvi. Putem sublicenția aceste drepturi doar furnizorilor care ne ajută să găzduim și să procesăm conținutul (de exemplu Mux pentru videoclipuri, Amazon Web Services pentru fotografii, Cloudflare pentru livrare), strict pentru acest scop.',
        '**Nu folosim conținutul tău în reclame plătite** (de exemplu reclame pe rețele sociale sau în alte aplicații) fără acordul tău separat.',
        '**Cât durează licența.** Cât timp conținutul este publicat. Când îl ștergi sau îți ștergi contul, încetăm să-l afișăm, cu excepția rezultatelor concursurilor, a cântăririlor, a rezervărilor, a recenziilor și a mesajelor din chatul concursurilor, care rămân, fără numele tău, ca parte din istoricul concursurilor și al bălților. Copii pot rămâne o perioadă limitată în copiile de siguranță și, ca dovadă, în evidența moderării, cum e descris în Politica de confidențialitate.',
        '**Răspunzi de ce publici.** Publici doar conținut pe care ai dreptul să-l publici (inclusiv muzica din videoclipuri și imaginile altor persoane). Datele capturilor (specie, greutate, lungime) trebuie să fie reale. Locul pe care îl asociezi unei postări sau povești (balta, apa publică, punctele de pe hartă) devine vizibil celorlalți: alege-l tu și nu publica locul altcuiva fără acordul lui.',
      ],
    },
    {
      id: 'reguli-continut',
      heading: '4. Ce conținut nu este permis',
      blocks: [
        'Avem **toleranță zero** față de conținutul ilegal și abuziv și față de utilizatorii care îl publică. Nu este permis:',
        {
          list: [
            'conținut ilegal sau care încurajează fapte ilegale;',
            'hărțuire, insulte, amenințări, intimidare sau urmărirea insistentă a altui utilizator, inclusiv prin mențiuni sau comentarii repetate;',
            'discurs de ură sau discriminare pe criterii de rasă, etnie, religie, sex, orientare sexuală, dizabilitate sau altele asemenea;',
            'nuditate, conținut sexual sau violență gratuită, inclusiv cruzime față de animale dincolo de manipularea obișnuită a capturii;',
            'imagini sau videoclipuri cu minori fără acordul părintelui sau al tutorelui lor; orice conținut care sexualizează sau pune în pericol minori este raportat autorităților;',
            'publicarea datelor personale ale altora fără acordul lor (de exemplu telefon, adresă, locul unde se află cineva) — „doxxing”;',
            'spam, reclame nesolicitate, conturi false sau imitarea altei persoane ori organizații;',
            'capturi, cântăriri sau recenzii false ori exagerate, menite să inducă în eroare;',
            'promovarea pescuitului ilegal: braconaj, pescuit în perioadă sau zonă de prohibiție, fără permis, cu unelte sau metode interzise, ori păstrarea exemplarelor sub dimensiunea legală;',
            'conținut care încalcă drepturile de autor, mărcile sau alte drepturi ale altora;',
            'viruși, coduri sau linkuri înșelătoare ori periculoase.',
          ],
        },
      ],
    },
    {
      id: 'raportare',
      heading: '5. Raportarea conținutului',
      blocks: [
        '**Din aplicație.** Poți raporta postări, comentarii, povești și recenzii din meniul lor, iar mesajele din chatul unui concurs ținând apăsat pe mesaj, alegând motivul. Conținutul raportat de tine nu ți se mai afișează. Poți bloca un utilizator din meniul conținutului, din chat sau din profilul lui; nu-i mai vezi conținutul și mesajele, iar el nu-l mai vede pe al tău.',
        `**Pe email, pentru oricine.** Orice persoană, inclusiv fără cont Bluvi, ne poate sesiza un conținut pe care îl consideră ilegal sau contrar acestor termeni (inclusiv un mesaj din chatul unui concurs) la ${OPERATOR.email}, conform art. 16 din Regulamentul (UE) 2022/2065 privind serviciile digitale („DSA”). Sesizarea trebuie să cuprindă:`,
        {
          list: [
            'explicația motivelor pentru care consideri conținutul ilegal sau contrar termenilor;',
            'locul exact al conținutului (linkul, de exemplu bluvi.ro/postari/…, sau o descriere suficientă ca să-l găsim în aplicație);',
            'numele și adresa ta de email (cu excepția sesizărilor privind abuzul sexual asupra copiilor, care pot fi anonime);',
            'o declarație că informațiile din sesizare sunt, după știința ta, exacte și complete.',
          ],
        },
        'Confirmăm primirea sesizării trimise pe email și îți comunicăm decizia luată și căile de contestare. Persoana raportată nu află cine a raportat-o, cu excepția cazurilor în care legea ne obligă.',
      ],
    },
    {
      id: 'moderare',
      heading: '6. Moderare și măsuri',
      blocks: [
        'Conținutul raportat este analizat manual de administratorii Bluvi. Nu filtrăm automat conținutul înainte de publicare. **O singură regulă automată:** o recenzie despre o baltă (sau un comentariu la ea) raportată de trei utilizatori diferiți este ascunsă automat până când un administrator o verifică; autorul primește motivarea pe email și poate contesta decizia ca pe oricare alta. Pentru conținutul vădit ilegal acționăm în cel mult 24 de ore de la primirea raportării; celelalte raportări le analizăm cât mai repede posibil, cu atenție și imparțialitate.',
        'În funcție de gravitate, putem lua una sau mai multe dintre măsurile următoare:',
        {
          list: [
            'ascunderea conținutului (postare, comentariu, poveste, recenzie, mesaj din chatul unui concurs) pentru ceilalți utilizatori; un mesaj ascuns din chat apare ca „Mesaj ascuns de moderare”;',
            'suspendarea contului, temporar sau definitiv; un cont suspendat nu se mai poate autentifica;',
            'păstrarea conținutului ca dovadă și sesizarea autorităților, când legea o cere.',
          ],
        },
        '**Motivarea deciziei (art. 17 DSA).** Când îți ascundem conținutul sau îți suspendăm contul, te informăm pe adresa de email a contului despre măsura luată, faptele și motivul (regula din acești termeni sau temeiul legal încălcat) și despre cum poți contesta decizia, cu excepția cazurilor în care legea ne interzice să te informăm.',
        'Suspendăm, după un avertisment, și conturile care trimit în mod repetat sesizări vădit nefondate.',
      ],
    },
    {
      id: 'feed',
      heading: '7. Cum ordonăm feed-ul',
      blocks: [
        'Feed-ul arată postările pescarilor și cardurile automate (rezultate de concurs, recenzii) **în ordine cronologică**, cele mai noi primele. Când ești conectat, postările pescarilor pe care îi urmărești sunt urcate cu câteva ore față de momentul publicării, ca să le vezi mai ușor. Nu ordonăm feed-ul după profilarea ta și nu există postări plătite sau promovate. Conținutul utilizatorilor blocați de tine și conținutul raportat de tine nu ți se afișează.',
        'Recomandările de pescari („Pescari sugerați”, „Descoperă pescari”) și criteriile lor sunt descrise în Politica de confidențialitate.',
      ],
    },
    {
      id: 'contestatii',
      heading: '8. Contestarea deciziilor',
      blocks: [
        `Dacă nu ești de acord cu o decizie de moderare (inclusiv cu decizia de a nu lua măsuri la o sesizare făcută de tine), ne poți scrie la ${OPERATOR.email}, în cel mult 6 luni de la comunicarea deciziei, explicând de ce o consideri greșită (art. 20 DSA). Contestația este analizată de un alt administrator decât cel care a luat decizia, iar răspunsul îl primești pe email. Dacă îți dăm dreptate, anulăm măsura.`,
        'Poți apela și la un organism de soluționare extrajudiciară a litigiilor certificat conform art. 21 DSA, la Autoritatea Națională pentru Administrare și Reglementare în Comunicații (ANCOM), coordonatorul serviciilor digitale în România, sau la instanțele competente.',
      ],
    },
    {
      id: 'punct-contact',
      heading: '9. Punct de contact',
      blocks: [
        `Punctul unic de contact pentru utilizatori și pentru autoritățile statelor membre, Comisia Europeană și Comitetul european pentru servicii digitale (art. 11 și 12 DSA) este ${OPERATOR.email}. Ne poți scrie în limba română sau în limba engleză.`,
      ],
    },
    {
      id: 'concursuri',
      heading: '10. Concursuri',
      blocks: [
        {
          list: [
            'Organizatorul fiecărui concurs stabilește regulamentul, taxa, premiile, alocarea standurilor și penalizările și răspunde de desfășurarea concursului și de respectarea legii (inclusiv a regulilor privind premiile).',
            'Bluvi pune la dispoziție instrumentele de înscriere, cântărire, clasament și comunicare. Clasamentul este calculat din cântăririle și penalizările introduse de organizator și arbitri; contestațiile se adresează organizatorului.',
            'Cântăririle sunt confirmate prin semnăturile arbitrului și ale martorului, care rămân atașate cântăririi.',
            'Informațiile afișate pe ecranul de blocare (Live Activities pe iPhone, notificarea permanentă pe Android) și în notificări sunt orientative și pot întârzia; clasamentul oficial este cel din pagina concursului, stabilit de organizator.',
            'Ca organizator, garantezi că ai dreptul să organizezi concursul la acea baltă și că informațiile publicate sunt corecte.',
          ],
        },
      ],
    },
    {
      id: 'rezervari',
      heading: '11. Rezervări la bălți',
      blocks: [
        {
          list: [
            'Rezervarea se face între tine și balta respectivă. Balta stabilește prețurile, regulile, condițiile de anulare și confirmarea; Bluvi transmite cererea și o afișează.',
            'Prețul afișat este cel comunicat de baltă și se plătește la fața locului, dacă balta nu precizează altfel.',
            'Dacă nu poți ajunge, anulează rezervarea din aplicație. Administratorul bălții poate marca o neprezentare, iar aceasta apare în reputația ta de pescar.',
            'După rezervare, tu poți evalua balta, iar balta te poate evalua pe tine.',
          ],
        },
      ],
    },
    {
      id: 'balti',
      heading: '12. Informațiile despre bălți și ape',
      blocks: [
        'Informațiile despre bălți (prețuri, program, specii, facilități) provin de la administratorii lor, de la utilizatori și din surse publice. Ne străduim să fie corecte, dar nu le putem garanta; verifică-le cu balta înainte de deplasare. Pentru ape publice respectă legislația privind pescuitul, inclusiv permisul de pescuit și perioadele de prohibiție.',
      ],
    },
    {
      id: 'siguranta',
      heading: '13. Siguranța la pescuit',
      blocks: [
        'Pescuitul se desfășoară în aer liber, lângă apă, uneori noaptea sau pe vreme rea. Ești singurul responsabil pentru siguranța ta și a celor care te însoțesc: verifică vremea și starea terenului, poartă echipament potrivit (de exemplu vestă de salvare în barcă) și respectă regulile bălții și legislația privind pescuitul.',
        'Informațiile din Bluvi (bălți, hărți, capturile și recenziile altora) au caracter informativ și nu înlocuiesc judecata ta la fața locului. Nu ne asumăm răspunderea pentru accidente, vătămări sau pagube suferite în timpul pescuitului, în limitele permise de lege.',
      ],
    },
    {
      id: 'reguli',
      heading: '14. Ce nu ai voie să faci',
      blocks: [
        {
          list: [
            'să folosești Bluvi în scopuri ilegale sau ca să hărțuiești, ameninți ori induci în eroare alți utilizatori;',
            'să publici conținutul interzis la secțiunea 4;',
            'să introduci cântăriri, capturi sau recenzii false ori să manipulezi clasamentele;',
            'să ocolești blocarea de către alt utilizator, o suspendare sau limitele de încărcare (de exemplu prin conturi noi);',
            'să accesezi Bluvi automat (roboți, extragere de date) fără acordul nostru, să ocolești măsurile de securitate sau să suprasoliciți serviciul;',
            'să copiezi sau să revinzi conținutul altora ori al Bluvi.',
          ],
        },
      ],
    },
    {
      id: 'sugestii',
      heading: '15. Sugestiile tale',
      blocks: [
        'Dacă ne trimiți idei, sugestii sau feedback despre Bluvi, le putem folosi pentru a îmbunătăți serviciul, fără obligația de a te plăti sau de a te menționa. Datele tale personale din feedback sunt tratate conform Politicii de confidențialitate.',
      ],
    },
    {
      id: 'proprietate',
      heading: '16. Proprietate intelectuală',
      blocks: [
        'Numele și sigla Bluvi, aplicația, site-ul și conținutul create de noi ne aparțin. Îți acordăm dreptul de a le folosi pentru uz personal, conform acestor termeni.',
      ],
    },
    {
      id: 'magazine',
      heading: '17. Magazinele de aplicații și serviciile terțe',
      blocks: [
        'Aplicația Bluvi se descarcă din App Store (Apple) și Google Play (Google), iar folosirea ei este supusă și condițiilor acestor magazine. Acești termeni sunt încheiați între tine și noi, nu cu Apple sau Google: noi, nu ei, răspundem de aplicație, de întreținerea și asistența ei și de orice pretenție legată de ea (inclusiv privind drepturi de proprietate intelectuală ale altora). Apple și filialele sale sunt terți beneficiari ai acestor termeni și îi pot invoca față de tine.',
        'Bluvi conține linkuri și integrări cu servicii ale altora (de exemplu autentificarea cu Apple, Google sau Facebook, hărțile, site-urile bălților). Acestea au propriile condiții și politici, iar noi nu răspundem pentru conținutul sau funcționarea lor.',
      ],
    },
    {
      id: 'raspundere',
      heading: '18. Disponibilitate și răspundere',
      blocks: [
        'Oferim Bluvi „ca atare”. Ne străduim să funcționeze fără întreruperi și fără erori, dar nu putem garanta acest lucru și putem modifica, suspenda sau opri funcții. Funcțiile au limite tehnice afișate în aplicație (de exemplu durata videoclipurilor sau numărul de încărcări pe zi).',
        'În limitele permise de lege, nu răspundem pentru acțiunile altor utilizatori, ale bălților sau ale organizatorilor de concursuri, pentru conținutul publicat de aceștia sau pentru pierderi indirecte. Nimic din acești termeni nu limitează drepturile tale de consumator prevăzute de lege și nici răspunderea noastră pentru culpă gravă sau intenție.',
      ],
    },
    {
      id: 'suspendare',
      heading: '19. Suspendarea și închiderea contului',
      blocks: [
        `Putem suspenda sau închide un cont care încalcă acești termeni sau legea, cum e descris la secțiunea 6, și te informăm despre motiv. Tu poți închide oricând contul din Setări; dacă îți este suspendat contul și vrei să-l ștergi, scrie-ne la ${OPERATOR.email}.`,
      ],
    },
    {
      id: 'modificari',
      heading: '20. Modificarea termenilor',
      blocks: [
        'Putem modifica acești termeni. Despre schimbările importante te anunțăm în aplicație sau pe email cu cel puțin 15 zile înainte să intre în vigoare, cu excepția celor impuse de lege sau necesare urgent pentru siguranța utilizatorilor. Dacă nu ești de acord, îți poți închide contul înainte de acea dată; dacă folosești Bluvi în continuare, accepți termenii modificați.',
      ],
    },
    {
      id: 'lege',
      heading: '21. Legea aplicabilă și litigii',
      blocks: [
        'Acești termeni sunt guvernați de legea română. Încercăm să rezolvăm orice nemulțumire pe cale amiabilă — scrie-ne mai întâi. Dacă nu reușim, litigiul se soluționează de instanțele competente din România. Ca și consumator, te poți adresa și Autorității Naționale pentru Protecția Consumatorilor (ANPC), anpc.ro.',
      ],
    },
    {
      id: 'clauze-finale',
      heading: '22. Clauze finale',
      blocks: [
        {
          list: [
            'Dacă o prevedere din acești termeni este considerată nevalabilă, restul termenilor rămân în vigoare.',
            'Faptul că nu aplicăm imediat o prevedere nu înseamnă că renunțăm la ea.',
            'Putem transfera drepturile și obligațiile din acești termeni unei alte societăți, de exemplu în cazul unei reorganizări sau vânzări a Bluvi, cu condiția ca drepturile tale să nu fie afectate; te anunțăm înainte. Tu nu poți transfera drepturile tale fără acordul nostru.',
            'Acești termeni sunt redactați în limba română; dacă publicăm și o traducere, versiunea în limba română prevalează.',
          ],
        },
      ],
    },
    {
      id: 'contact',
      heading: '23. Contact',
      blocks: [`${OPERATOR.name}, ${OPERATOR.address}. Email: ${OPERATOR.email}.`],
    },
  ],
};
