/*
 * The files that let the Bluvi app claim this site's links (owner 2026-10-14: the app moves off
 * bluvi-app.wearetribus.com to bluvi.ro). Served from app/.well-known/* on every host of this
 * project: bluvi.ro (the links people share) and app.bluvi.ro (the site's «Deschide în aplicație»
 * buttons — iOS never opens the app for a link to the page's own domain, so those point at the
 * subdomain; proxy.ts sends a visitor without the app on from there).
 *
 * iOS: the AASA `paths` decide which URLs open the app, and iOS reads the file when the app is
 * installed or updated. Android: assetlinks.json verifies the whole domain; the app's intent
 * filters (fish app.json) pick the paths. A path listed here must be one the app can open (fish
 * app/+native-intent.tsx maps it); anything else it sends to its home screen.
 */

const IOS_APP_ID = 'Z93U2J23L6.com.tribustech.bluvi';

/** The web's own paths (shared links) and the app's (app.bluvi.ro buttons, old links). */
export const APP_LINK_PATHS = [
  '/balti/*',
  '/concursuri/*',
  '/partide/*',
  '/sondaje',
  '/sondaje/*',
  '/pescari/*',
  '/rezervari',
  '/rezervari/*',
  '/stiri/*',
  '/ape-publice/*',
  '/lakes/*',
  '/competitions/*',
  '/polls/*',
  '/anglers/*',
  '/bookings',
  '/bookings/*',
  '/news/*',
  '/public-waters/*',
] as const;

export const appleAppSiteAssociation = {
  applinks: { apps: [], details: [{ appID: IOS_APP_ID, paths: [...APP_LINK_PATHS] }] },
};

/** The release and upload keys' SHA-256 (same file as bluvi-redirect-stores). */
export const assetLinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.tribustech.bluvi',
      sha256_cert_fingerprints: [
        '41:B9:4B:BA:A7:28:A6:49:71:AD:9F:5A:D8:06:E7:91:40:82:74:18:18:CE:84:27:56:6B:58:AA:0B:D9:07:1B',
        '38:CE:D2:8A:32:84:52:60:FA:0E:ED:49:E8:3B:C8:52:98:FF:FB:89:E4:71:1E:1B:6D:F7:A2:80:92:A2:68:00',
      ],
    },
  },
];
