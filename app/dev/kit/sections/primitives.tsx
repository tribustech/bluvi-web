import {
  BellIcon,
  ChevronRightIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import {
  CatchIcon,
  DeadFishIcon,
  FishIcon,
  FishingRodIcon,
  SadSearchIcon,
  SadStarIcon,
  ScaleIcon,
  StandPinIcon,
} from "@/components/icons/brand";
import { Avatar, FaceStack, type FacePerson } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { CountTile, StatTile } from "@/components/ui/BentoTile";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SignatureNumber } from "@/components/ui/SignatureNumber";
import { StatusPill } from "@/components/ui/StatusPill";

/* Sample data — Fundații §07, verbatim. */
const FACES: FacePerson[] = [
  { name: "Radu Ionescu", tone: "indigo" },
  { name: "Mihai Popa", tone: "tint" },
  { name: "Andrei Dumitru", tone: "success" },
  { name: "Vlad Stan", tone: "warning" },
  { name: "Cristian Toma", tone: "neutral" },
];

const BRAND_ICONS = [
  { name: "fish", Icon: FishIcon },
  { name: "cântar", Icon: ScaleIcon },
  { name: "lansetă", Icon: FishingRodIcon },
  { name: "captură", Icon: CatchIcon },
  { name: "capot", Icon: DeadFishIcon },
  { name: "stand", Icon: StandPinIcon },
  { name: "gol", Icon: SadSearchIcon },
  { name: "fără recenzii", Icon: SadStarIcon },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <h3 className="t-body-strong text-ink-2">{title}</h3>
      {children}
    </div>
  );
}

/** /dev/kit section: primitives — Fundații §07 left/right columns, then extra states. */
export function PrimitivesSection() {
  return (
    <>
      <h2 className="t-title1">Primitive</h2>
      <div className="flex flex-col gap-8 rounded-bento bg-surface p-5 xl:p-10">
        {/* Right column wider than half so the CountTile caption keeps one line (design: 596px). */}
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex flex-col gap-3.5">
            <Group title="Butoane · 48px mobil / 40px desktop · raza 10">
              <div className="flex flex-wrap items-center gap-2.5">
                <Button>Înscrie-te</Button>
                <Button variant="secondary">Urmărește</Button>
                <Button variant="outline">Vezi regulament</Button>
                <Button variant="danger">Aplică penalizare</Button>
                <Button variant="ghost">Anulează</Button>
                <Button disabled>Înscrieri închise</Button>
              </div>
            </Group>
            <Group title="Pastile de stare · raza 999 (stare) vs badge-uri · raza 2 (atribute)">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone="live">LIVE</StatusPill>
                <StatusPill tone="success">Înscrieri deschise</StatusPill>
                <StatusPill tone="warning">Ultimele 3 locuri</StatusPill>
                <StatusPill tone="info">Viitor</StatusPill>
                <StatusPill tone="neutral">Încheiat</StatusPill>
                <StatusPill tone="cancelled">Anulat</StatusPill>
                <StatusPill tone="capot">capot</StatusPill>
                <StatusPill tone="pending">2 în așteptare</StatusPill>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge color="green">Individual</Badge>
                <Badge color="yellow">Cantitate/Calitate</Badge>
                <Badge color="indigo">Best of 5</Badge>
                <Badge color="solidIndigo">Verificată</Badge>
              </div>
            </Group>
          </div>

          <div className="flex flex-col gap-3.5">
            <Group title="Tile-uri bento · CountTile (navy) + StatTile (page)">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[1.2fr_1fr_1fr]">
                <CountTile
                  className="col-span-2 md:col-span-1"
                  label="LIVE ACUM"
                  value="3"
                  caption="concursuri · 1.284 urmăresc"
                />
                <StatTile
                  label="Înscrieri"
                  value="38"
                  unit="/48"
                  unitTone="faint"
                  progress={{
                    value: 38,
                    max: 48,
                    label: "38 din 48 de locuri ocupate",
                  }}
                />
                <StatTile
                  label="Începe în"
                  value="4"
                  unit=" zile"
                  caption="sâm, 11 oct · 07:00"
                />
              </div>
            </Group>
            <Group title="Avatare & FaceStack · inițiale (anglerInitials.ts) când lipsește poza">
              <div className="flex flex-wrap items-center gap-6">
                <FaceStack
                  people={FACES}
                  overflow={33}
                  label="38 de pescari înscriși"
                  className="pl-2"
                />
                <Avatar name="Mihai Popa" tone="indigo" />
                <Avatar name="Cristian Radu" tone="tint" shape="square" />
              </div>
            </Group>
          </div>
        </div>

        {/* Beyond the §07 frame: the rest of each component's range. */}
        <div className="grid grid-cols-1 gap-10 border-t border-hairline pt-8 xl:grid-cols-2">
          <Group title="Butoane cu icon · link · lățime plină">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button icon={<BellIcon />}>Urmărește concursul</Button>
              <Button variant="secondary" icon={<ShareIcon />}>
                Distribuie
              </Button>
              <ButtonLink
                variant="outline"
                href="/dev/kit"
                iconRight={<ChevronRightIcon />}
              >
                Vezi toate
              </ButtonLink>
              <Button variant="outline" disabled>
                Vezi regulament
              </Button>
            </div>
            <Button block>Înscrie-te</Button>
          </Group>

          <Group title="Badge-uri · toate culorile din Badge.tsx">
            <div className="flex flex-wrap gap-1.5">
              <Badge color="indigo">Best of 5</Badge>
              <Badge color="solidIndigo">Verificată</Badge>
              <Badge color="green">Individual</Badge>
              <Badge color="gray">Echipe</Badge>
              <Badge color="yellow">Cantitate</Badge>
              <Badge color="red">Penalizare</Badge>
              <Badge color="indigo" icon={<FishIcon />}>
                No-kill
              </Badge>
            </div>
          </Group>

          <Group title="Cifra semnătură · count (64 mobil / 96 desktop) · −6,25% din mărime">
            <div className="flex flex-wrap items-end gap-10">
              <SignatureNumber
                value="412,6"
                unit=" kg"
                caption="total sector A"
              />
              <SignatureNumber
                size="stat"
                value="18,4"
                unit=" kg"
                caption="cea mai mare captură"
              />
            </div>
            <div className="flex flex-wrap gap-2.5">
              <CountTile
                className="w-full md:w-80"
                label="CEA MAI MARE CAPTURĂ"
                value="18,42"
                unit=" kg"
                caption="Radu Ionescu · 04:37"
              />
              <StatTile
                tone="page"
                className="w-full md:w-56"
                icon={<ScaleIcon />}
                label="Cântăriri"
                value="126"
                caption="ultima acum 3 min"
              />
            </div>
          </Group>

          <Group title="Avatare · mărimi, rotund / pătrat r12, poză, stivă mică">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name="Radu Ionescu" size={24} />
              <Avatar name="Radu Ionescu" size={32} />
              <Avatar name="Radu Ionescu" size={40} />
              <Avatar name="Radu Ionescu" size={48} />
              <Avatar name="Radu Ionescu" size={64} />
              <Avatar name="Echipa Crap Club" size={48} shape="square" />
              <Avatar name="Ionel" size={48} />
              <Avatar name="" size={48} />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <FaceStack
                people={FACES.slice(0, 3)}
                size={24}
                label="3 pescari"
                className="pl-1.5"
              />
              <FaceStack
                people={FACES.slice(0, 4)}
                overflow={7}
                size={40}
                label="11 pescari"
                className="pl-2.5"
              />
            </div>
          </Group>

          <div className="xl:col-span-2">
            <Group title="Iconițe Bluvi · currentColor">
              <div className="grid grid-cols-4 gap-2.5 md:grid-cols-8">
                {BRAND_ICONS.map(({ name, Icon }) => (
                  <div
                    key={name}
                    className="flex flex-col items-center gap-1.5 rounded-avatar bg-accent-tint py-3 text-accent"
                  >
                    <Icon size={28} />
                    <span className="t-micro text-accent-ink">{name}</span>
                  </div>
                ))}
              </div>
            </Group>
          </div>
        </div>
      </div>
    </>
  );
}
