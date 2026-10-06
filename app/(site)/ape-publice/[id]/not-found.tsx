import { WaterNotFound } from '../_components/states';

/** An unknown id / linkCode, or an empty param (parity public-waters.detaliu.c1/c3): no retry. */
export default function NotFound() {
  return <WaterNotFound />;
}
