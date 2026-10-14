import { OPERATOR, type LegalDocument } from './document';

/* Termeni și condiții — written 2026-10-14 for what Bluvi offers today (no payments through Bluvi). */
export const TERMS: LegalDocument = {
  title: 'Termeni și condiții',
  description: 'Regulile de folosire a aplicației Bluvi și a site-ului bluvi.ro: contul, conținutul tău, concursuri, rezervări și răspunderea.',
  updated: '14 octombrie 2026',
  updatedIso: '2026-10-14',
  intro: [
    `Acești termeni se aplică aplicației mobile Bluvi și site-ului bluvi.ro („Bluvi”), operate de ${OPERATOR.name}, CUI ${OPERATOR.cui}, nr. Registrul Comerțului ${OPERATOR.regCom}, cu sediul în ${OPERATOR.address} („noi”).`,
    'Când îți creezi cont sau folosești Bluvi accepți acești termeni. Dacă nu ești de acord cu ei, te rugăm să nu folosești Bluvi. Felul în care prelucrăm datele tale este descris în Politica de confidențialitate.',
  ],
  sections: [
    {
      id: 'serviciul',
      heading: '1. Ce este Bluvi',
      blocks: [
        'Bluvi este o platformă pentru pescari: descoperi bălți și ape publice, ții evidența partidelor și a capturilor, participi la concursuri sau le organizezi, rezervi standuri la bălțile care primesc rezervări, lași recenzii și urmărești alți pescari.',
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
            'Datele din profil (numele de utilizator, telefonul) trebuie să fie reale și să nu imite o altă persoană sau o organizație.',
            'Îți poți șterge oricând contul din Setări. Ce se întâmplă cu datele tale este descris în Politica de confidențialitate.',
          ],
        },
      ],
    },
    {
      id: 'continut',
      heading: '3. Conținutul tău',
      blocks: [
        'Rămâi proprietarul fotografiilor, textelor și celorlalte conținuturi pe care le publici. Ne acorzi o licență neexclusivă, gratuită, valabilă în toată lumea, să le găzduim, să le afișăm și să le distribuim în Bluvi (inclusiv pe site și în materialele de prezentare a Bluvi), cât timp sunt publicate și, pentru rezultatele concursurilor și istoricul bălților, și după aceea.',
        'Publici doar conținut pe care ai dreptul să-l publici. Nu publici conținut ilegal, ofensator, discriminatoriu, înșelător, spam sau date personale ale altora fără acordul lor.',
        'Putem ascunde sau șterge conținut care încalcă acești termeni sau legea și putem suspenda contul celui care îl publică.',
      ],
    },
    {
      id: 'concursuri',
      heading: '4. Concursuri',
      blocks: [
        {
          list: [
            'Organizatorul fiecărui concurs stabilește regulamentul, taxa, premiile, alocarea standurilor și penalizările și răspunde de desfășurarea concursului și de respectarea legii (inclusiv a regulilor privind premiile).',
            'Bluvi pune la dispoziție instrumentele de înscriere, cântărire, clasament și comunicare. Clasamentul este calculat din cântăririle și penalizările introduse de organizator și arbitri; contestațiile se adresează organizatorului.',
            'Cântăririle sunt confirmate prin semnăturile arbitrului și ale martorului, care rămân atașate cântăririi.',
            'Ca organizator, garantezi că ai dreptul să organizezi concursul la acea baltă și că informațiile publicate sunt corecte.',
          ],
        },
      ],
    },
    {
      id: 'rezervari',
      heading: '5. Rezervări la bălți',
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
      heading: '6. Informațiile despre bălți și ape',
      blocks: [
        'Informațiile despre bălți (prețuri, program, specii, facilități) provin de la administratorii lor, de la utilizatori și din surse publice. Ne străduim să fie corecte, dar nu le putem garanta; verifică-le cu balta înainte de deplasare. Pentru ape publice respectă legislația privind pescuitul, inclusiv permisul de pescuit și perioadele de prohibiție.',
      ],
    },
    {
      id: 'reguli',
      heading: '7. Ce nu ai voie să faci',
      blocks: [
        {
          list: [
            'să folosești Bluvi în scopuri ilegale sau ca să hărțuiești, ameninți ori induci în eroare alți utilizatori;',
            'să introduci cântăriri, capturi sau recenzii false ori să manipulezi clasamentele;',
            'să accesezi Bluvi automat (roboți, extragere de date) fără acordul nostru, să ocolești măsurile de securitate sau să suprasoliciți serviciul;',
            'să copiezi sau să revinzi conținutul altora ori al Bluvi.',
          ],
        },
      ],
    },
    {
      id: 'proprietate',
      heading: '8. Proprietate intelectuală',
      blocks: [
        'Numele și sigla Bluvi, aplicația, site-ul și conținutul create de noi ne aparțin. Îți acordăm dreptul de a le folosi pentru uz personal, conform acestor termeni.',
      ],
    },
    {
      id: 'raspundere',
      heading: '9. Disponibilitate și răspundere',
      blocks: [
        'Oferim Bluvi „ca atare”. Ne străduim să funcționeze fără întreruperi și fără erori, dar nu putem garanta acest lucru și putem modifica, suspenda sau opri funcții.',
        'În limitele permise de lege, nu răspundem pentru acțiunile altor utilizatori, ale bălților sau ale organizatorilor de concursuri, pentru conținutul publicat de aceștia sau pentru pierderi indirecte. Nimic din acești termeni nu limitează drepturile tale de consumator prevăzute de lege și nici răspunderea noastră pentru culpă gravă sau intenție.',
      ],
    },
    {
      id: 'suspendare',
      heading: '10. Suspendarea și închiderea contului',
      blocks: [
        'Putem suspenda sau închide un cont care încalcă acești termeni sau legea, de regulă după ce te anunțăm. Tu poți închide oricând contul din Setări.',
      ],
    },
    {
      id: 'modificari',
      heading: '11. Modificarea termenilor',
      blocks: [
        'Putem modifica acești termeni. Despre schimbările importante te anunțăm în aplicație sau pe email înainte să intre în vigoare; dacă folosești Bluvi în continuare, accepți termenii modificați.',
      ],
    },
    {
      id: 'lege',
      heading: '12. Legea aplicabilă și litigii',
      blocks: [
        'Acești termeni sunt guvernați de legea română. Încercăm să rezolvăm orice nemulțumire pe cale amiabilă — scrie-ne mai întâi. Dacă nu reușim, litigiul se soluționează de instanțele competente din România. Ca și consumator, te poți adresa și Autorității Naționale pentru Protecția Consumatorilor (ANPC), anpc.ro.',
      ],
    },
    {
      id: 'contact',
      heading: '13. Contact',
      blocks: [`${OPERATOR.name}, ${OPERATOR.address}. Email: ${OPERATOR.email}.`],
    },
  ],
};
