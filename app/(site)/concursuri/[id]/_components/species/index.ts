import type { StaticImageData } from 'next/image';
import amur from './amur.png';
import avat from './avat.jpg';
import babusca from './babusca.jpg';
import biban from './biban.png';
import buffalo from './buffalo.jpg';
import carasAuriu from './caras-auriu.jpg';
import caras from './caras.png';
import clean from './clean.jpg';
import crapCteno from './crap-cteno.jpg';
import crapOglinda from './crap-oglinda.jpg';
import crap from './crap.jpg';
import fitofag from './fitofag.jpg';
import koi from './koi.jpg';
import lin from './lin.jpg';
import novac from './novac.jpg';
import oblet from './oblet.png';
import pastrav from './pastrav.jpg';
import platica from './platica.png';
import rosioara from './rosioara.jpg';
import salau from './salau.jpg';
import salonta from './salonta.jpg';
import scoicar from './scoicar.jpg';
import somnClarias from './somn-clarias.jpg';
import somn from './somn.jpg';
import stiuca from './stiuca.jpg';
import sturion from './sturion.jpg';
import ton from './ton.jpg';
import placeholderSmall from './placeholder-small.jpg';

/*
 * fish helpers/getFishImage.ts, 1:1: the species artwork of «Pești de prins» (parity
 * competition-page.informatii.c8), fish assets/images/fish/* downsized to 480px for the web
 * (next/image serves them optimised). An unknown species gets fish's placeholder.
 * TODO(kit, T3 owner): move to the kit with SpeciesCards when the lake page's species adopt it.
 */
const BY_NAME: Record<string, StaticImageData> = {
  'amurul': amur,
  'amur': amur,
  'caras': caras,
  'crap': crap,
  'crap oglinda': crapOglinda,
  'cteno': crapCteno,
  'fitofag': fitofag,
  'pastrav': pastrav,
  'salau': salau,
  'somn': somn,
  'stiuca': stiuca,
  'biban': biban,
  'platica': platica,
  'avat': avat,
  'buffalo': buffalo,
  'lin': lin,
  'novac': novac,
  'sturion': sturion,
  'clean': clean,
  'somn clarias': somnClarias,
  'babusca': babusca,
  'caras auriu': carasAuriu,
  'koi': koi,
  'rosioara': rosioara,
  'scoicar': scoicar,
  'ton': ton,
  'salonta': salonta,
  'oblet': oblet,
};

/** fish matches the CMS name exactly; the web also forgives case and diacritics («Știucă» = «Stiuca»). */
const key = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

export function speciesImage(name: string): StaticImageData {
  return BY_NAME[key(name)] ?? placeholderSmall;
}
