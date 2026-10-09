# M8 — Schema URL-urilor: propunere pentru owner

Data: 2026-10-09 · branch `v2` · doar propunere, **nimic din ce e mai jos nu e implementat** în afară de redirecturile de la „Ce merge deja”.

## Pe scurt

- Azi fiecare pagină publică are adresa cu `documentId`-ul din CMS (`/balti/s84u55lo4n9z0emngozttt6e`). Funcționează, dar nu spune nimic omului sau lui Google.
- Recomandarea mea: **slug + documentId complet** (`/balti/chita-lake-s84u55lo4n9z0emngozttt6e`). **Nu cere nimic în CMS**: web-ul face slugul din numele pe care îl citește deja, iar adresele vechi dau 308 la forma nouă.
- Pentru domeniu recomand **opțiunea A**: web-ul pe domeniul lui (de ex. `bluvi.ro`), iar `bluvi-app.wearetribus.com` rămâne domeniul linkurilor către aplicație. Cere **reguli de redirect pe server în Amplify** (nu o schimbare în codul React al `bluvi-redirect-stores`).
- **Decizii necesare: 4** (vezi la final).

## Ce merge deja (M8-B1)

Toate adresele pe care aplicația le-a distribuit sau pe care le deschide o notificare duc pe pagina web corectă, cu redirect permanent (308). Lista completă e în `next.config.ts` și în `tests/e2e/legacy-redirects.cases.ts`. Câteva exemple:

| Link din aplicație | Pagina web |
|---|---|
| `/competitions/{id}` (și `?activeTabId=clasament`, `participanti`…) | `/concursuri/{id}` (și `/clasament`, `/participanti`…) |
| `/competitions/{id}?openWeighingSheet=1&standId&weighingId` | `/concursuri/{id}/cantare?cantar=…&stand=…` |
| `/competitions/{id}/chat?tab=participants` | `/concursuri/{id}/chat?tab=participanti` |
| `/lakes/{id}`, `/lakes/{id}/reviews` | `/balti/{id}`, `/balti/{id}/recenzii` |
| `/lakes/{id}/gallery`, `/map`, `/capturi`, `/concursuri`, `/partide`, `/standuri`, `/statistici`, `/clasament` | `/balti/{id}/galerie`, `/harta`, același nume pentru restul |
| `/lakes/review/{id}` | `/balti/{id}/recenzie` |
| `/penalties/{id}/apply`, `/penalties/{id}/select-stand` | `/concursuri/{id}/penalizari/aplica`, `/penalizari/stand` |
| `/competitions/stand-timeline/{id}` | `/concursuri/{id}/statistici/cronologie` |
| `/news/{id}`, `/organizer`, `/penalties/{id}` | `/stiri/{id}`, `/organizator`, `/concursuri/{id}/penalizari` |
| `/operator/{lakeId}/bookings?status=` | `/operator/{lakeId}/rezervari?status=` |
| `/partide/comunitate/capturi/{id}`, `/partide/comunitate/galerie/{id}`, `/partide/comunitate/{id}` | `/partide/{id}/capturi`, `/partide/{id}/galerie`, `/partide/{id}` |
| `/partide/join/{cod}`, `/partide/start` | `/partide` (temporar, 307) |

Note:

- **Invitația la partidă** duce la `/partide`, nu la `/partide/intra/{cod}` cum scria în inventar. Partidele se pornesc doar din aplicație (regula 21 din ROADMAP §4b). Redirectul e temporar (307), ca să-l putem schimba fără să rămână în cache-ul browserelor.
- **Parametrii vechi rămân în adresă.** Next lipește query-ul cererii la orice redirect din `next.config`, deci `timestamp`, `activeTabId` și restul ajung și pe pagina nouă. Paginile îi ignoră. Ca să dispară ar trebui un redirect în `proxy.ts`. Nu merită acum: sunt linkuri vechi, iar Google nu le vede.
- **Chatul folosește `?tab=`, nu `?camera=`.** Așa citește pagina web de chat deja, așa că am păstrat numele.

## 1. Slug sau documentId

| | documentId (azi) | **slug + documentId complet** | slug + id scurt | doar slug |
|---|---|---|---|---|
| Exemplu | `/balti/s84u55lo4n9z0emngozttt6e` | `/balti/chita-lake-s84u55lo4n9z0emngozttt6e` | `/balti/chita-lake-s84u55` | `/balti/chita-lake` |
| SEO | numele lipsește din adresă | numele e în adresă | numele e în adresă | numele e în adresă |
| Lungime | scurtă, ilizibilă | lungă (24 de caractere de id la final) | scurtă | cea mai scurtă |
| Coliziuni de nume | nu există | nu există (id-ul le separă) | nu există, dacă prefixul e unic | „Lacul Mare” apare în mai multe județe → trebuie `-2`, `-3` |
| Redenumire | nimic de făcut | slugul greșit face 308 la cel nou (id-ul găsește pagina) | la fel | trebuie un istoric de sluguri în CMS |
| Cum găsește web-ul pagina | id-ul din adresă | id-ul de după ultima cratimă (documentId-urile nu au cratime) → ruta `/feed/*` de detaliu de azi | prefixul de 6 caractere → **nu există rută**: niciun `/feed/*` de detaliu nu caută după prefix | slugul → rută nouă `by-slug` |
| Cost în CMS | zero | **zero**: fără câmp `slug`, fără lookup nou | rută `/feed/…/by-prefix/:id` (`filters[documentId][$startsWith]`) + verificare de unicitate a prefixului la creare | câmp `slug` unic + istoric + rută `by-slug` |

**Câștigul SEO e mic, dar real.** Contează mai ales la bălți și concursuri, unde oamenii caută după nume („Chita Lake”, „Cupa …”). Titlul, descrierea și JSON-LD-ul spun deja asta lui Google. Slugul ajută mai ales la clic, pentru că adresa citibilă inspiră încredere în rezultate și pe rețelele sociale.

**Recomandare: slug + documentId complet**, doar pentru bălți, concursuri, știri și ape publice. Pescarii și partidele rămân pe documentId: sunt date personale și nu le vrem optimizate pentru căutare.

- Adresa e mai lungă decât cu id scurt, dar câștigul SEO vine din cuvintele din adresă, nu din lungime.
- Id-ul scurt arată mai bine, dar **nu e gratuit**: un prefix de documentId se poate găsi doar cu o căutare după prefix, pe care nicio rută `/feed/*` de detaliu nu o are. Ar cere o rută nouă în CMS și o verificare de unicitate. Dacă îl preferi, e o schimbare de backend (nu am deschis niciun PR).

### Ce ar cere (doar propunere)

- **În CMS: nimic.** Web-ul face slugul din numele pe care îl citește deja (fără diacritice, litere mici, cratime) și îl pune în fața id-ului.
- **În web:** `lib/routes` construiește adresa cu slug oriunde are numele (liste, detalii, sitemap, Open Graph, „Distribuie”). Pagina de detaliu ia id-ul de după ultima cratimă, citește entitatea ca azi și, dacă slugul din adresă nu e cel calculat din nume (redenumire, slug lipsă sau greșit), face 308 la forma canonică.
- „Doar slug” ar cere câmp `slug` unic în CMS, o rută `/feed/lakes/by-slug/:slug` și o tabelă de istoric pentru redenumiri.

### Strategia de redirect

- Adresele de azi cu documentId **rămân valide pentru totdeauna**: `/balti/{id}` dă 308 la `/balti/{slug}-{id}`. Redirectul se face în pagină (are nevoie de nume), nu în `next.config`.
- Fiecare pagină pune `<link rel="canonical">` pe adresa cu slug. Sitemap-ul, Open Graph-ul și butonul „Distribuie” folosesc doar forma canonică.
- Un link vechi din aplicație (`bluvi-app…/lakes/{id}`), deschis fără aplicație, ar trece prin: redirectul Amplify spre web (opțiunea A, mai jos) → 308 `/lakes/{id}` → `/balti/{id}` → 308 spre forma cu slug. **Trei redirecturi pe server.** Google le urmează și transmite semnalele. Se pot scurta cu un hop dacă regulile Amplify trimit direct la ruta românească, dar atunci tabela de redirecturi ar exista în două locuri.

## 2. Domeniul și linkurile către aplicație

Azi `bluvi-app.wearetribus.com` e domeniul linkurilor universale ale aplicației. iOS (AASA) și Android (`autoVerify`) deschid aplicația pentru `/competitions/*`, `/lakes/*`, `/polls/*` și `/partide/*`. Când linkul nu deschide aplicația, ajunge pe `bluvi-redirect-stores`, un SPA React (Vite) găzduit pe Amplify:

- `/competitions/{id}` arată **un clasament** (`CompetitionRanking`). Acesta e linkul cel mai distribuit: butonul „Distribuie” de pe pagina concursului din aplicație.
- `/lakes/*`, `/polls/*`, `/partide/*` și orice altă cale arată pagina de prezentare și, pe telefon, trimit în magazin (`SmartStoreRedirect`). Pe desktop rămân pe pagina de prezentare.
- Totul e făcut în JavaScript, în browser. Serverul Amplify răspunde la orice cale cu același `index.html`. **Google și previzualizările din WhatsApp/Facebook văd doar acest shell**: niciun redirect, niciun semnal transmis mai departe, niciun card Open Graph.
- **Browserele din aplicații** (Instagram, Facebook, Messenger, TikTok) nu declanșează linkurile universale. Cine apasă acolo un link `bluvi-app…`, chiar dacă are aplicația, ajunge azi pe site: în magazin sau la clasamentul SPA.

### Opțiunea A — web-ul pe domeniul lui (de ex. `bluvi.ro`) · **recomandată**

- Linkurile din aplicațiile deja instalate nu se schimbă. Pe telefon cu aplicația, `bluvi-app…/lakes/x` deschide în continuare aplicația. Sistemul (iOS/Android) prinde linkul **înainte de orice cerere HTTP**, deci un redirect pe server nu le afectează.
- `bluvi-redirect-stores` primește **reguli de redirect pe server în Amplify** (consola Amplify → „Rewrites and redirects”, sau `customRules` prin `aws amplify update-app`; `amplify.yml` ține doar header-ele). Nu e o schimbare în codul React: o redirecționare făcută din JavaScript nu ar ajuta crawlerele.
  - Ordinea contează (prima regulă potrivită câștigă). Mai întâi excepțiile, servite ca azi: `/.well-known/<*>` (AASA și `assetlinks.json`, regulile existente rămân primele), `/ios`, `/android` și fișierele SPA-ului de care au nevoie (`/assets/<*>`).
  - Apoi regula generală: `/<*>` → `https://bluvi.ro/<*>`, **301**. Amplify nu are 308 (are doar 301/302/200/404), dar pentru GET 301 e echivalent. Web-ul face apoi 308 de la `/lakes/x` la `/balti/x` cu tabela de mai sus.
  - De verificat la configurare: că Amplify păstrează query-ul (`?activeTabId=`, `?openWeighingSheet=`). Fără el, linkurile spre un tab ajung pe pagina concursului, nu pe tab.
- Riscuri mici: AASA și `assetlinks.json` nu se schimbă, aplicația nu are nevoie de build nou. Excepția pentru `/.well-known/*` trebuie verificată după deploy (`curl -I` pe ambele fișiere: 200, nu 301).
- Minus: există două domenii. Aplicația distribuie linkuri pe `bluvi-app…`, iar web-ul pe `bluvi.ro`. Când aplicația va distribui linkuri web, va avea nevoie de un build nou cu domeniul nou în `associatedDomains`.

### Opțiunea B — web-ul preia `bluvi-app.wearetribus.com`

- Web-ul ar trebui să servească el `/.well-known/apple-app-site-association` și `/.well-known/assetlinks.json`, identic cu cele de azi. Altfel aplicațiile instalate nu mai deschid linkurile.
- Pe telefon cu aplicația, căile din AASA deschid aplicația. În rest, adică pe desktop, pe telefon fără aplicație, în browserele din aplicații sau pe orice altă cale, se deschide web-ul.
- Câștig: un singur domeniu pentru oameni și pentru aplicație, fără hopul Amplify.
- Riscuri: dacă un deploy greșește un singur fișier `.well-known`, toate linkurile aplicației se strică până la următoarea verificare Apple (cache CDN Apple, ore sau zile). Mai e și numele: `wearetribus.com` nu e un domeniu de brand pentru SEO.

**Recomandare: A acum**, cu `bluvi.ro` (sau ce domeniu alegi) pe web. B se poate face mai târziu, când aplicația trece pe domeniul de brand. Atunci ar fi un build nou cu `associatedDomains` pe ambele domenii, iar web-ul ar servi AASA pe domeniul nou.

## Decizii necesare

1. **Domeniul web-ului** (A cu ce domeniu, sau B).
2. **Slug: da sau nu.** Dacă da, care formă (recomand slug + documentId complet, fără nicio schimbare în CMS) și pentru ce entități. Id-ul scurt ar cere o rută nouă în CMS.
3. **Ce face `bluvi-redirect-stores` cu vizitatorii fără aplicație** (doar la A):
   - **Pagina de clasament `/competitions/{id}`**: o retragem (regula generală o trimite la `/concursuri/{id}`, care are clasamentul, cardul Open Graph și restul concursului) sau o păstrăm (atunci `/competitions/<*>` devine excepție în Amplify și crawlerele văd în continuare doar shell-ul SPA). Recomand retragerea.
   - **Telefon fără aplicație**: pagina web echivalentă (recomand: are buton spre aplicație) sau magazinul, ca azi. Regula de server nu știe dacă e telefon; „magazin pe telefon” ar însemna să păstrăm SPA-ul pentru căile din AASA.
   - **Browserele din aplicații** (Instagram, Facebook): cu regula generală, cine apasă acolo ajunge pe web, chiar dacă are aplicația instalată. Azi ajunge în magazin sau la clasament. Pagina web e mai utilă decât magazinul pentru cine are deja aplicația.
   - **Pagina de prezentare `/`**: rămâne pe Amplify sau trece la web.
4. **Când aplicația distribuie linkuri web** (`/balti/…` în loc de `/lakes/…`). Cere build nou și domeniul în `associatedDomains`.
