import { FeaturePage, featureMetadata } from '../_seo/FeaturePage';

// SEO landing (lib/lake-landing.ts FEATURES): the shared feature page, for this slug.
export const generateMetadata = () => featureMetadata('cu-iluminat-nocturn');

export default function Page() {
  return <FeaturePage slug="cu-iluminat-nocturn" />;
}
