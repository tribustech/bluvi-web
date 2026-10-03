import type { ComponentType, SVGProps } from 'react';
import {
  BoltIcon,
  FaceSmileIcon,
  FireIcon,
  HeartIcon,
  HomeIcon,
  HomeModernIcon,
  LifebuoyIcon,
  LightBulbIcon,
  MoonIcon,
  PuzzlePieceIcon,
  RectangleStackIcon,
  ShoppingBagIcon,
  SparklesIcon,
  Squares2X2Icon,
  TableCellsIcon,
  TruckIcon,
  UserCircleIcon,
  UsersIcon,
  VideoCameraIcon,
  WifiIcon,
} from '@heroicons/react/24/outline';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * fish helpers/getFacilityIcon.ts#facilityToIconNew, keyed by the same lower-cased facility name.
 * fish mixes heroicons with lucide; the web ships heroicons only, so the lucide entries take the
 * closest heroicon (noted per line).
 */
const FACILITY_ICON: Record<string, Icon> = {
  pontoane: Squares2X2Icon, // lucide SquareKanban
  cabane: HomeModernIcon,
  sling: TableCellsIcon,
  'saltea primire': RectangleStackIcon, // lucide Bed
  toaletă: SparklesIcon, // lucide Toilet
  chicinetă: FireIcon, // lucide CookingPot
  parcare: TruckIcon, // lucide SquareParking
  'camere de supraveghere': VideoCameraIcon, // lucide Cctv
  'wi-fi': WifiIcon,
  'iluminat nocturn': LightBulbIcon,
  'dușuri disponibile': SparklesIcon,
  'zonă pentru grătar': FireIcon, // lucide CookingPot
  'acces auto': TruckIcon, // lucide SquareParking
  'echipamente de închiriat': TableCellsIcon,
  'posibilitate de cazare': HomeModernIcon,
  'pescuit de pe barcă': LifebuoyIcon, // lucide Ship
  'prize disponibile': BoltIcon,
  'foișor acoperit': HomeIcon,
  'pescuit la plantat': PuzzlePieceIcon, // lucide Joystick
  'animale de companie acceptate': HeartIcon, // lucide PawPrint
  'loc de joacă pentru copii': FaceSmileIcon, // lucide Baby
  'potrivit pentru familii': UsersIcon,
  'magazin cu momeli': ShoppingBagIcon,
  'pescuit pe timp de noapte': MoonIcon,
  'accesibil persoanelor cu dizabilități': UserCircleIcon, // lucide Accessibility
  'acceptă animale de companie': HeartIcon, // lucide PawPrint
};

/** fish `getFacilityIconNew` */
export function facilityIcon(name: string): Icon {
  return FACILITY_ICON[name.toLowerCase()] ?? HomeIcon;
}
