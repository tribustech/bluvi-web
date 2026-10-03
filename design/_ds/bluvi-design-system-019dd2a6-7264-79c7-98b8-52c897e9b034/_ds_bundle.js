/* @ds-bundle: {"format":4,"namespace":"BluviDesignSystem_019dd2","components":[],"sourceHashes":{"banner/banners.jsx":"c427a324b695","banner/design-canvas.jsx":"862a6db59c7c","banner/phone-mocks.jsx":"c93ea097f9f0","chat/ChatSheet.jsx":"67a152b2c63d","chat/tweaks-panel.jsx":"22c052960f83","ui_kits/mobile/AppScreens.jsx":"743ec3b31f0e","ui_kits/mobile/AuthScreens.jsx":"ac8a432ce366","ui_kits/mobile/Primitives.jsx":"8a579c0bead7","ui_kits/mobile/ios-frame.jsx":"d67eb3ffe562"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BluviDesignSystem_019dd2 = window.BluviDesignSystem_019dd2 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// banner/banners.jsx
try { (() => {
// 3 banner variations — 1080×1080 Instagram squares.
const {
  PhoneFrame,
  ScreenCompetition,
  ScreenRankings,
  ScreenStats,
  BluviC
} = window;
const C = BluviC;
const FONT = '"Nunito", -apple-system, system-ui, sans-serif';

// ─────────────────────────────────────────────────────────
// Variation 1: STACKED EDITORIAL
// White bg. Three phones in a fanned stack. Editorial stat callouts.
// ─────────────────────────────────────────────────────────
function BannerStackedEditorial() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1080,
      height: 1080,
      background: '#fff',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: FONT
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 32,
      border: `1px solid ${C.gray2}`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 64,
      left: 64,
      right: 64,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/bluvi_horizontal.png",
    style: {
      height: 48
    },
    alt: "Bluvi"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: C.red6
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.gray10,
      letterSpacing: 1.4,
      textTransform: 'uppercase'
    }
  }, "Sezonul 2026 \xB7 Live acum"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 160,
      left: 64,
      width: 540
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.indigo5,
      letterSpacing: 3,
      textTransform: 'uppercase'
    }
  }, "Concursuri \xB7 Clasamente \xB7 Statistici"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: C.gray10,
      margin: '14px 0 18px',
      width: 60
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 64,
      fontWeight: 800,
      color: C.gray10,
      lineHeight: 1.02,
      letterSpacing: -1.5
    }
  }, "Pescuie\u0219te.", /*#__PURE__*/React.createElement("br", null), "C\xE2nt\u0103re\u0219te.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.indigo5
    }
  }, "C\xE2\u0219tig\u0103.")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      color: C.gray5,
      marginTop: 18,
      lineHeight: 1.45,
      maxWidth: 440
    }
  }, "Comunitatea pescarilor rom\xE2ni \u2014 \xEEntr-un singur loc. \xCEnscrie-te la concursuri, urm\u0103re\u0219te clasamentele live \u0219i descoper\u0103 cele mai bune b\u0103l\u021Bi.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 64,
      bottom: 96,
      display: 'flex',
      gap: 36
    }
  }, [{
    v: '2.4k+',
    k: 'Pescari'
  }, {
    v: '124',
    k: 'Bălți'
  }, {
    v: '42',
    k: 'Concursuri live'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      fontWeight: 800,
      color: C.gray10,
      letterSpacing: -0.5
    }
  }, s.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      marginTop: 4
    }
  }, s.k)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 140,
      right: -30,
      width: 600,
      height: 820
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 40,
      right: 280,
      transform: 'rotate(-10deg)',
      filter: 'drop-shadow(0 28px 40px rgba(99,102,241,.18))'
    }
  }, /*#__PURE__*/React.createElement(PhoneFrame, {
    scale: 0.95
  }, /*#__PURE__*/React.createElement(ScreenStats, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      right: 60,
      filter: 'drop-shadow(0 32px 50px rgba(0,0,0,.18))'
    }
  }, /*#__PURE__*/React.createElement(PhoneFrame, {
    scale: 1.05
  }, /*#__PURE__*/React.createElement(ScreenRankings, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 160,
      right: -100,
      transform: 'rotate(8deg)',
      filter: 'drop-shadow(0 36px 56px rgba(0,0,0,.22))'
    }
  }, /*#__PURE__*/React.createElement(PhoneFrame, {
    scale: 1
  }, /*#__PURE__*/React.createElement(ScreenCompetition, null)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 64,
      right: 64,
      fontSize: 14,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: 1.5,
      textTransform: 'uppercase'
    }
  }, "bluvi.ro"));
}

// ─────────────────────────────────────────────────────────
// Variation 2: SPLIT INDIGO
// Diagonal indigo/white split. Two phones + floating UI snippets escaping.
// ─────────────────────────────────────────────────────────
function BannerSplitIndigo() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1080,
      height: 1080,
      background: '#fff',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: FONT
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: C.indigo5,
      clipPath: 'polygon(0 0, 100% 0, 100% 62%, 0 88%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 60,
      left: 60,
      right: 60,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 54,
      height: 54,
      borderRadius: 14,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/fish-logo.svg",
    style: {
      width: 32,
      height: 32
    },
    alt: ""
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 800,
      color: '#fff',
      letterSpacing: -1
    }
  }, "Bluvi")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 14px',
      background: 'rgba(255,255,255,.16)',
      borderRadius: 999,
      backdropFilter: 'blur(4px)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: '#fff'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase'
    }
  }, "Live"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 170,
      left: 60,
      width: 520,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: '#fff',
      opacity: .7,
      letterSpacing: 3,
      textTransform: 'uppercase'
    }
  }, "Concursuri \xB7 Clasamente"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 74,
      fontWeight: 800,
      color: '#fff',
      lineHeight: .98,
      letterSpacing: -2,
      marginTop: 14
    }
  }, "Marele clasament."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: '#fff',
      opacity: .88,
      marginTop: 18,
      lineHeight: 1.5,
      maxWidth: 430
    }
  }, "\xCEnscrie-te la concursuri, urm\u0103re\u0219te live c\xE2nt\u0103ririle \u0219i vezi cine conduce \u2014 totul \xEEn Bluvi."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      marginTop: 28,
      padding: '14px 24px',
      background: '#fff',
      color: C.indigo5,
      borderRadius: 10,
      fontSize: 16,
      fontWeight: 700,
      boxShadow: '0 4px 14px rgba(0,0,0,.18)'
    }
  }, "Descarc\u0103 aplica\u021Bia \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 54,
      left: 60,
      display: 'flex',
      gap: 36,
      alignItems: 'flex-end'
    }
  }, [{
    v: '1.284 kg',
    k: 'Capturate'
  }, {
    v: '126',
    k: 'Pescari live'
  }, {
    v: '42',
    k: 'Concursuri'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 800,
      color: C.gray10,
      letterSpacing: -0.5
    }
  }, s.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      marginTop: 4
    }
  }, s.k)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 120,
      right: -40,
      width: 600,
      height: 880
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 120,
      right: 240,
      transform: 'rotate(-8deg)',
      filter: 'drop-shadow(0 30px 50px rgba(0,0,0,.30))'
    }
  }, /*#__PURE__*/React.createElement(PhoneFrame, {
    scale: 0.95
  }, /*#__PURE__*/React.createElement(ScreenCompetition, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 80,
      right: -30,
      transform: 'rotate(6deg)',
      filter: 'drop-shadow(0 36px 60px rgba(0,0,0,.32))'
    }
  }, /*#__PURE__*/React.createElement(PhoneFrame, {
    scale: 1.08
  }, /*#__PURE__*/React.createElement(ScreenRankings, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 30,
      right: 280,
      background: '#fff',
      borderRadius: 14,
      padding: '12px 16px',
      boxShadow: '0 18px 40px rgba(0,0,0,.20)',
      transform: 'rotate(-4deg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: 1.5,
      textTransform: 'uppercase'
    }
  }, "Locul 1"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 999,
      background: C.indigo5
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.gray10
    }
  }, "Mihai I."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.indigo5
    }
  }, "12.4 kg")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 8,
      padding: '4px 8px',
      background: '#FEF9C3',
      color: C.yellow6,
      fontSize: 10,
      fontWeight: 700,
      borderRadius: 2
    }
  }, "#1")))));
}

// ─────────────────────────────────────────────────────────
// Variation 3: MAGAZINE COVER
// Indigo bg, single hero phone center, floating data tiles.
// ─────────────────────────────────────────────────────────
function BannerMagazineCover() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1080,
      height: 1080,
      background: C.indigo7,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: FONT
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(circle at 50% 40%, ${C.indigo5} 0%, ${C.indigo7} 70%)`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 54,
      left: 60,
      right: 60,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 3,
      textTransform: 'uppercase',
      opacity: .75
    }
  }, "Vol. 04 \xB7 Noiembrie 2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 3,
      textTransform: 'uppercase',
      opacity: .75
    }
  }, "bluvi.ro")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 88,
      left: 60,
      right: 60,
      height: 1,
      background: 'rgba(255,255,255,.18)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 120,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/bluvi_horizontal.png",
    style: {
      height: 62,
      filter: 'brightness(0) invert(1)'
    },
    alt: "Bluvi"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: 5,
      textTransform: 'uppercase',
      opacity: .78
    }
  }, "Concursuri \xB7 Clasamente \xB7 Statistici")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 248,
      left: '50%',
      transform: 'translateX(-50%)',
      filter: 'drop-shadow(0 50px 70px rgba(0,0,0,.45))'
    }
  }, /*#__PURE__*/React.createElement(PhoneFrame, {
    scale: 1.05
  }, /*#__PURE__*/React.createElement(ScreenCompetition, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 300,
      left: 80,
      width: 240,
      background: '#fff',
      borderRadius: 16,
      padding: 14,
      boxShadow: '0 24px 60px rgba(0,0,0,.30)',
      transform: 'rotate(-3deg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: 1.6,
      textTransform: 'uppercase'
    }
  }, "Clasament live"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, [{
    p: 1,
    name: 'Mihai I.',
    kg: '12.4',
    av: C.indigo5,
    c: C.yellow6
  }, {
    p: 2,
    name: 'Andrei P.',
    kg: '10.8',
    av: C.green3,
    c: C.gray5
  }, {
    p: 3,
    name: 'Ștefan V.',
    kg: '9.2',
    av: C.yellow6,
    c: '#B45309'
  }].map(r => /*#__PURE__*/React.createElement("div", {
    key: r.p,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      fontSize: 13,
      fontWeight: 800,
      color: r.c
    }
  }, "#", r.p), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 999,
      background: r.av,
      opacity: .9
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 12,
      fontWeight: 700,
      color: C.gray10
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.indigo5
    }
  }, r.kg, " kg"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 280,
      right: 70,
      width: 210,
      background: '#fff',
      borderRadius: 16,
      padding: '16px 18px',
      boxShadow: '0 24px 60px rgba(0,0,0,.30)',
      transform: 'rotate(4deg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: 1.6,
      textTransform: 'uppercase'
    }
  }, "Capturate \xB7 Sezon"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 4,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 40,
      fontWeight: 800,
      color: C.gray10,
      letterSpacing: -1,
      lineHeight: 1
    }
  }, "1.284"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.gray5
    }
  }, "kg")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 3,
      height: 24,
      marginTop: 10
    }
  }, [40, 55, 38, 72, 48, 90, 62, 80, 50, 70, 58, 85].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: `${h}%`,
      background: C.indigo5,
      borderRadius: '2px 2px 0 0'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 170,
      left: 90,
      width: 230,
      background: '#fff',
      borderRadius: 16,
      padding: '14px 16px',
      boxShadow: '0 24px 60px rgba(0,0,0,.30)',
      transform: 'rotate(2deg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: 1.6,
      textTransform: 'uppercase'
    }
  }, "Pescari activi"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, [C.indigo4, C.green3, C.yellow6, C.red5, C.indigo5].map((bg, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 28,
      height: 28,
      borderRadius: 999,
      background: bg,
      border: '2.5px solid #fff',
      marginLeft: i ? -10 : 0
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: C.gray10,
      letterSpacing: -0.5
    }
  }, "2.4k"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 200,
      right: 80,
      width: 230,
      background: '#fff',
      borderRadius: 16,
      padding: '14px 16px',
      boxShadow: '0 24px 60px rgba(0,0,0,.30)',
      transform: 'rotate(-3deg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: C.red6
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: C.red6,
      letterSpacing: 1.6,
      textTransform: 'uppercase'
    }
  }, "Live acum")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: C.gray10,
      marginTop: 6,
      lineHeight: 1.15
    }
  }, "Cupa Crapului"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.indigo5,
      marginTop: 2
    }
  }, "Lacul Snagov \xB7 18/24")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 54,
      left: 60,
      right: 60,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 3,
      textTransform: 'uppercase',
      opacity: .78
    }
  }, "Comunitatea pescarilor rom\xE2ni"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: 3,
      textTransform: 'uppercase',
      opacity: .78
    }
  }, "Descarc\u0103 aplica\u021Bia")));
}
Object.assign(window, {
  BannerStackedEditorial,
  BannerSplitIndigo,
  BannerMagazineCover
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "banner/banners.jsx", error: String((e && e.message) || e) }); }

// banner/design-canvas.jsx
try { (() => {
// DesignCanvas.jsx — Figma-ish design canvas wrapper
// Warm gray grid bg + Sections + Artboards + PostIt notes.
// Artboards are reorderable (grip-drag), deletable, labels/titles are
// inline-editable, and any artboard can be opened in a fullscreen focus
// overlay (←/→/Esc). State persists to a .design-canvas.state.json sidecar
// via the host bridge. No assets, no deps.
//
// Usage:
//   <DesignCanvas>
//     <DCSection id="onboarding" title="Onboarding" subtitle="First-run variants">
//       <DCArtboard id="a" label="A · Dusk" width={260} height={480}>…</DCArtboard>
//       <DCArtboard id="b" label="B · Minimal" width={260} height={480}>…</DCArtboard>
//     </DCSection>
//   </DesignCanvas>

const DC = {
  bg: '#f0eee9',
  grid: 'rgba(0,0,0,0.06)',
  label: 'rgba(60,50,40,0.7)',
  title: 'rgba(40,30,20,0.85)',
  subtitle: 'rgba(60,50,40,0.6)',
  postitBg: '#fef4a8',
  postitText: '#5a4a2a',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
};

// One-time CSS injection (classes are dc-prefixed so they don't collide with
// the hosted design's own styles).
if (typeof document !== 'undefined' && !document.getElementById('dc-styles')) {
  const s = document.createElement('style');
  s.id = 'dc-styles';
  s.textContent = ['.dc-editable{cursor:text;outline:none;white-space:nowrap;border-radius:3px;padding:0 2px;margin:0 -2px}', '.dc-editable:focus{background:#fff;box-shadow:0 0 0 1.5px #c96442}', '[data-dc-slot]{transition:transform .18s cubic-bezier(.2,.7,.3,1)}', '[data-dc-slot].dc-dragging{transition:none;z-index:10;pointer-events:none}', '[data-dc-slot].dc-dragging .dc-card{box-shadow:0 12px 40px rgba(0,0,0,.25),0 0 0 2px #c96442;transform:scale(1.02)}',
  // isolation:isolate contains artboard content's z-indexes so a
  // z-indexed child (sticky navbar etc.) can't paint over .dc-header or
  // the .dc-menu popover that drops into the top of the card.
  '.dc-card{isolation:isolate;transition:box-shadow .15s,transform .15s}', '.dc-card *{scrollbar-width:none}', '.dc-card *::-webkit-scrollbar{display:none}',
  // Per-artboard header: grip + label on the left, delete/expand on the
  // right. Single flex row; when the artboard's on-screen width is too
  // narrow for both the label yields (ellipsis, then hidden entirely below
  // ~4ch via the container query) and the buttons stay on the row.
  '.dc-header{position:absolute;bottom:100%;left:-4px;margin-bottom:calc(4px * var(--dc-inv-zoom,1));z-index:2;', '  display:flex;align-items:center;container-type:inline-size}', '.dc-labelrow{display:flex;align-items:center;gap:4px;height:24px;flex:1 1 auto;min-width:0}', '.dc-grip{flex:0 0 auto;cursor:grab;display:flex;align-items:center;padding:5px 4px;border-radius:4px;transition:background .12s,opacity .12s}', '.dc-grip:hover{background:rgba(0,0,0,.08)}', '.dc-grip:active{cursor:grabbing}', '.dc-labeltext{flex:1 1 auto;min-width:0;cursor:pointer;border-radius:4px;padding:3px 6px;', '  display:flex;align-items:center;transition:background .12s;overflow:hidden}',
  // Below ~4ch of label room: hide the label entirely, and drop the grip to
  // hover-only (same reveal rule as .dc-btns) so a narrow header is clean
  // until the card is moused.
  '@container (max-width: 110px){', '  .dc-labeltext{display:none}', '  .dc-grip{opacity:0}', '  [data-dc-slot]:hover .dc-grip{opacity:1}', '}', '.dc-labeltext:hover{background:rgba(0,0,0,.05)}', '.dc-labeltext .dc-editable{overflow:hidden;text-overflow:ellipsis;max-width:100%}', '.dc-labeltext .dc-editable:focus{overflow:visible;text-overflow:clip}', '.dc-btns{flex:0 0 auto;margin-left:auto;display:flex;gap:2px;opacity:0;transition:opacity .12s}', '[data-dc-slot]:hover .dc-btns,.dc-btns:has(.dc-menu){opacity:1}', '.dc-expand,.dc-kebab{width:22px;height:22px;border-radius:5px;border:none;cursor:pointer;padding:0;', '  background:transparent;color:rgba(60,50,40,.7);display:flex;align-items:center;justify-content:center;', '  font:inherit;transition:background .12s,color .12s}', '.dc-expand:hover,.dc-kebab:hover{background:rgba(0,0,0,.06);color:#2a251f}',
  // Slot hosting an open menu floats above later siblings (which otherwise
  // paint on top — same z-index:auto, later DOM order) so the popup isn't
  // clipped by the next card.
  '[data-dc-slot]:has(.dc-menu){z-index:10}', '.dc-menu{position:absolute;top:100%;right:0;margin-top:4px;background:#fff;border-radius:8px;', '  box-shadow:0 8px 28px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.05);padding:4px;min-width:160px;z-index:10}', '.dc-menu button{display:block;width:100%;padding:7px 10px;border:0;background:transparent;', '  border-radius:5px;font-family:inherit;font-size:13px;font-weight:500;line-height:1.2;', '  color:#29261b;cursor:pointer;text-align:left;transition:background .12s;white-space:nowrap}', '.dc-menu button:hover{background:rgba(0,0,0,.05)}', '.dc-menu hr{border:0;border-top:1px solid rgba(0,0,0,.08);margin:4px 2px}', '.dc-menu .dc-danger{color:#c96442}', '.dc-menu .dc-danger:hover{background:rgba(201,100,66,.1)}',
  // Chrome (titles / labels / buttons) counter-scales against the viewport
  // zoom so it stays a constant on-screen size. --dc-inv-zoom is set by
  // DCViewport on every transform update and inherits to all descendants —
  // any overlay inside the world (e.g. a TweaksPanel on an artboard) can use
  // it the same way.
  //
  // The header uses transform:scale (out-of-flow, so layout impact doesn't
  // matter) with its world-space width set to card-width / inv-zoom so that
  // after counter-scaling its on-screen width exactly matches the card's —
  // that's what lets the container query + text-overflow behave against the
  // card's visible edge at every zoom level.
  //
  // The section head uses CSS zoom instead of transform so its layout box
  // grows with the counter-scale, pushing the card row down — otherwise the
  // constant-screen-size title would overflow into the (shrinking) world-
  // space gap and overlap the artboard headers at low zoom.
  '.dc-header{width:calc((100% + 4px) / var(--dc-inv-zoom,1));', '  transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom left}', '.dc-sectionhead{zoom:var(--dc-inv-zoom,1)}'].join('\n');
  document.head.appendChild(s);
}
const DCCtx = React.createContext(null);

// ─────────────────────────────────────────────────────────────
// DesignCanvas — stateful wrapper around the pan/zoom viewport.
// Owns runtime state (per-section order, renamed titles/labels, hidden
// artboards, focused artboard). Order/titles/labels/hidden persist to a
// .design-canvas.state.json
// sidecar next to the HTML. Reads go via plain fetch() so the saved
// arrangement is visible anywhere the HTML + sidecar are served together
// (omelette preview, direct link, downloaded zip). Writes go through the
// host's window.omelette bridge — editing requires the omelette runtime.
// Focus is ephemeral.
// ─────────────────────────────────────────────────────────────
const DC_STATE_FILE = '.design-canvas.state.json';
function DesignCanvas({
  children,
  minScale,
  maxScale,
  style
}) {
  const [state, setState] = React.useState({
    sections: {},
    focus: null
  });
  // Hold rendering until the sidecar read settles so the saved order/titles
  // appear on first paint (no source-order flash). didRead gates writes until
  // the read settles so the empty initial state can't clobber a slow read;
  // skipNextWrite suppresses the one echo-write that would otherwise follow
  // hydration.
  const [ready, setReady] = React.useState(false);
  const didRead = React.useRef(false);
  const skipNextWrite = React.useRef(false);
  React.useEffect(() => {
    let off = false;
    fetch('./' + DC_STATE_FILE).then(r => r.ok ? r.json() : null).then(saved => {
      if (off || !saved || !saved.sections) return;
      skipNextWrite.current = true;
      setState(s => ({
        ...s,
        sections: saved.sections
      }));
    }).catch(() => {}).finally(() => {
      didRead.current = true;
      if (!off) setReady(true);
    });
    const t = setTimeout(() => {
      if (!off) setReady(true);
    }, 150);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, []);
  React.useEffect(() => {
    if (!didRead.current) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    const t = setTimeout(() => {
      window.omelette?.writeFile(DC_STATE_FILE, JSON.stringify({
        sections: state.sections
      })).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [state.sections]);

  // Build registries synchronously from children so FocusOverlay can read
  // them in the same render. Only direct DCSection > DCArtboard children are
  // walked — wrapping them in other elements opts out of focus/reorder.
  const registry = {}; // slotId -> { sectionId, artboard }
  const sectionMeta = {}; // sectionId -> { title, subtitle, slotIds[] }
  const sectionOrder = [];
  React.Children.forEach(children, sec => {
    if (!sec || sec.type !== DCSection) return;
    const sid = sec.props.id ?? sec.props.title;
    if (!sid) return;
    sectionOrder.push(sid);
    const persisted = state.sections[sid] || {};
    const abs = [];
    React.Children.forEach(sec.props.children, ab => {
      if (!ab || ab.type !== DCArtboard) return;
      const aid = ab.props.id ?? ab.props.label;
      if (aid) abs.push([aid, ab]);
    });
    // hidden is scoped to one source revision — when the agent regenerates
    // (artboard-ID set changes), prior deletes don't apply to new content.
    const srcKey = abs.map(([k]) => k).join('\x1f');
    const hidden = persisted.srcKey === srcKey ? persisted.hidden || [] : [];
    const srcIds = [];
    abs.forEach(([aid, ab]) => {
      if (hidden.includes(aid)) return;
      registry[`${sid}/${aid}`] = {
        sectionId: sid,
        artboard: ab
      };
      srcIds.push(aid);
    });
    const kept = (persisted.order || []).filter(k => srcIds.includes(k));
    sectionMeta[sid] = {
      title: persisted.title ?? sec.props.title,
      subtitle: sec.props.subtitle,
      slotIds: [...kept, ...srcIds.filter(k => !kept.includes(k))]
    };
  });
  const api = React.useMemo(() => ({
    state,
    section: id => state.sections[id] || {},
    patchSection: (id, p) => setState(s => ({
      ...s,
      sections: {
        ...s.sections,
        [id]: {
          ...s.sections[id],
          ...(typeof p === 'function' ? p(s.sections[id] || {}) : p)
        }
      }
    })),
    setFocus: slotId => setState(s => ({
      ...s,
      focus: slotId
    }))
  }), [state]);

  // Esc exits focus; any outside pointerdown commits an in-progress rename.
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') api.setFocus(null);
    };
    const onPd = e => {
      const ae = document.activeElement;
      if (ae && ae.isContentEditable && !ae.contains(e.target)) ae.blur();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPd, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPd, true);
    };
  }, [api]);
  return /*#__PURE__*/React.createElement(DCCtx.Provider, {
    value: api
  }, /*#__PURE__*/React.createElement(DCViewport, {
    minScale: minScale,
    maxScale: maxScale,
    style: style
  }, ready && children), state.focus && registry[state.focus] && /*#__PURE__*/React.createElement(DCFocusOverlay, {
    entry: registry[state.focus],
    sectionMeta: sectionMeta,
    sectionOrder: sectionOrder
  }));
}

// ─────────────────────────────────────────────────────────────
// DCViewport — transform-based pan/zoom (internal)
//
// Input mapping (Figma-style):
//   • trackpad pinch  → zoom   (ctrlKey wheel; Safari gesture* events)
//   • trackpad scroll → pan    (two-finger)
//   • mouse wheel     → zoom   (notched; distinguished from trackpad scroll)
//   • middle-drag / primary-drag-on-bg → pan
//
// Transform state lives in a ref and is written straight to the DOM
// (translate3d + will-change) so wheel ticks don't go through React —
// keeps pans at 60fps on dense canvases.
// ─────────────────────────────────────────────────────────────
function DCViewport({
  children,
  minScale = 0.1,
  maxScale = 8,
  style = {}
}) {
  const vpRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const tf = React.useRef({
    x: 0,
    y: 0,
    scale: 1
  });
  // Persist viewport across reloads so the user lands back where they were
  // after an agent edit or browser refresh. The sandbox origin is already
  // per-project; pathname keeps multiple canvas files in one project apart.
  const tfKey = 'dc-viewport:' + location.pathname;
  const saveT = React.useRef(0);
  const lastPostedScale = React.useRef();
  const apply = React.useCallback(() => {
    const {
      x,
      y,
      scale
    } = tf.current;
    const el = worldRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    // Exposed for zoom-invariant chrome (labels, buttons, TweaksPanel).
    el.style.setProperty('--dc-inv-zoom', String(1 / scale));
    // Keep the host toolbar's % readout in sync with the canvas scale. Pan
    // ticks leave scale unchanged — skip the cross-frame post for those.
    if (lastPostedScale.current !== scale) {
      lastPostedScale.current = scale;
      window.parent.postMessage({
        type: '__dc_zoom',
        scale
      }, '*');
    }
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      try {
        localStorage.setItem(tfKey, JSON.stringify(tf.current));
      } catch {}
    }, 200);
  }, [tfKey]);
  React.useLayoutEffect(() => {
    const flush = () => {
      clearTimeout(saveT.current);
      try {
        localStorage.setItem(tfKey, JSON.stringify(tf.current));
      } catch {}
    };
    try {
      const s = JSON.parse(localStorage.getItem(tfKey) || 'null');
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.scale)) {
        tf.current = {
          x: s.x,
          y: s.y,
          scale: Math.min(maxScale, Math.max(minScale, s.scale))
        };
        apply();
      }
    } catch {}
    // Flush on pagehide and unmount so a reload within the 200ms debounce
    // window doesn't drop the last pan/zoom.
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
  React.useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const zoomAt = (cx, cy, factor) => {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left,
        py = cy - r.top;
      const t = tf.current;
      const next = Math.min(maxScale, Math.max(minScale, t.scale * factor));
      const k = next / t.scale;
      // keep the world point under the cursor fixed
      t.x = px - (px - t.x) * k;
      t.y = py - (py - t.y) * k;
      t.scale = next;
      apply();
    };

    // Mouse-wheel vs trackpad-scroll heuristic. A physical wheel sends
    // line-mode deltas (Firefox) or large integer pixel deltas with no X
    // component (Chrome/Safari, typically multiples of 100/120). Trackpad
    // two-finger scroll sends small/fractional pixel deltas, often with
    // non-zero deltaX. ctrlKey is set by the browser for trackpad pinch.
    const isMouseWheel = e => e.deltaMode !== 0 || e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40;
    const onWheel = e => {
      e.preventDefault();
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      if ((e.ctrlKey || e.metaKey) && !isMouseWheel(e)) {
        // trackpad pinch, or ctrl/cmd + smooth-scroll mouse. Notched
        // wheels fall through to the fixed-step branch below.
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
      } else {
        // trackpad two-finger scroll — pan
        tf.current.x -= e.deltaX;
        tf.current.y -= e.deltaY;
        apply();
      }
    };

    // Safari sends native gesture* events for trackpad pinch with a smooth
    // e.scale; preferring these over the ctrl+wheel fallback gives a much
    // better feel there. No-ops on other browsers. Safari also fires
    // ctrlKey wheel events during the same pinch — isGesturing makes
    // onWheel drop those entirely so they neither zoom nor pan.
    let gsBase = 1;
    let isGesturing = false;
    const onGestureStart = e => {
      e.preventDefault();
      isGesturing = true;
      gsBase = tf.current.scale;
    };
    const onGestureChange = e => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, gsBase * e.scale / tf.current.scale);
    };
    const onGestureEnd = e => {
      e.preventDefault();
      isGesturing = false;
    };

    // Drag-pan: middle button anywhere, or primary button on canvas
    // background (anything that isn't an artboard or an inline editor).
    let drag = null;
    const onPointerDown = e => {
      const onBg = !e.target.closest('[data-dc-slot], .dc-editable');
      if (!(e.button === 1 || e.button === 0 && onBg)) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      drag = {
        id: e.pointerId,
        lx: e.clientX,
        ly: e.clientY
      };
      vp.style.cursor = 'grabbing';
    };
    const onPointerMove = e => {
      if (!drag || e.pointerId !== drag.id) return;
      tf.current.x += e.clientX - drag.lx;
      tf.current.y += e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      apply();
    };
    const onPointerUp = e => {
      if (!drag || e.pointerId !== drag.id) return;
      vp.releasePointerCapture(e.pointerId);
      drag = null;
      vp.style.cursor = '';
    };

    // Host-driven zoom (toolbar % menu). Zooms around viewport centre so the
    // visible midpoint stays fixed — matching the host's iframe-zoom feel.
    const onHostMsg = e => {
      const d = e.data;
      if (d && d.type === '__dc_set_zoom' && typeof d.scale === 'number') {
        const r = vp.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, d.scale / tf.current.scale);
      } else if (d && d.type === '__dc_probe') {
        // Host's [readyGen] reset asks whether a canvas is present; it
        // fires on the iframe's native 'load', which for canvases with
        // images/fonts is after our mount-time announce, so re-announce.
        // Clear the pan-tick guard so apply() re-posts the current scale
        // even if it's unchanged — the host just reset dcScale to 1.
        window.parent.postMessage({
          type: '__dc_present'
        }, '*');
        lastPostedScale.current = undefined;
        apply();
      }
    };
    window.addEventListener('message', onHostMsg);
    // Announce canvas mode so the host toolbar proxies its % control here
    // instead of scaling the iframe element (which would just shrink the
    // viewport window of an infinite canvas). The apply() that follows emits
    // the initial __dc_zoom so the toolbar % is correct before first pinch.
    // lastPostedScale reset mirrors the __dc_probe handler: the layout
    // effect's restore-path apply() may already have posted the restored
    // scale (before __dc_present), so clear the guard to re-post it in order.
    window.parent.postMessage({
      type: '__dc_present'
    }, '*');
    lastPostedScale.current = undefined;
    apply();
    vp.addEventListener('wheel', onWheel, {
      passive: false
    });
    vp.addEventListener('gesturestart', onGestureStart, {
      passive: false
    });
    vp.addEventListener('gesturechange', onGestureChange, {
      passive: false
    });
    vp.addEventListener('gestureend', onGestureEnd, {
      passive: false
    });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('message', onHostMsg);
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', onGestureStart);
      vp.removeEventListener('gesturechange', onGestureChange);
      vp.removeEventListener('gestureend', onGestureEnd);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply, minScale, maxScale]);
  const gridSvg = `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M120 0H0v120' fill='none' stroke='${encodeURIComponent(DC.grid)}' stroke-width='1'/%3E%3C/svg%3E")`;
  return /*#__PURE__*/React.createElement("div", {
    ref: vpRef,
    className: "design-canvas",
    style: {
      height: '100vh',
      width: '100vw',
      background: DC.bg,
      overflow: 'hidden',
      overscrollBehavior: 'none',
      touchAction: 'none',
      position: 'relative',
      fontFamily: DC.font,
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: worldRef,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      transformOrigin: '0 0',
      willChange: 'transform',
      width: 'max-content',
      minWidth: '100%',
      minHeight: '100%',
      padding: '60px 0 80px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: -6000,
      backgroundImage: gridSvg,
      backgroundSize: '120px 120px',
      pointerEvents: 'none',
      zIndex: -1
    }
  }), children));
}

// ─────────────────────────────────────────────────────────────
// DCSection — editable title + h-row of artboards in persisted order
// ─────────────────────────────────────────────────────────────
function DCSection({
  id,
  title,
  subtitle,
  children,
  gap = 48
}) {
  const ctx = React.useContext(DCCtx);
  const sid = id ?? title;
  const all = React.Children.toArray(children);
  const artboards = all.filter(c => c && c.type === DCArtboard);
  const rest = all.filter(c => !(c && c.type === DCArtboard));
  const sec = ctx && sid && ctx.section(sid) || {};
  // Must match DesignCanvas's srcKey computation exactly (it filters falsy
  // IDs), or onDelete persists a srcKey that DesignCanvas never recognizes.
  const allIds = artboards.map(a => a.props.id ?? a.props.label).filter(Boolean);
  const srcKey = allIds.join('\x1f');
  const hidden = sec.srcKey === srcKey ? sec.hidden || [] : [];
  const srcOrder = allIds.filter(k => !hidden.includes(k));
  const order = React.useMemo(() => {
    const kept = (sec.order || []).filter(k => srcOrder.includes(k));
    return [...kept, ...srcOrder.filter(k => !kept.includes(k))];
  }, [sec.order, srcOrder.join('|')]);
  const byId = Object.fromEntries(artboards.map(a => [a.props.id ?? a.props.label, a]));

  // marginBottom counter-scales so the on-screen gap between sections stays
  // constant — otherwise at low zoom the (world-space) gap collapses while
  // the screen-constant sectionhead below it doesn't, and the title reads as
  // belonging to the section above. paddingBottom below is just enough for
  // the 24px artboard-header (abs-positioned above each card) plus ~8px, so
  // the title sits tight against its own row at every zoom.
  return /*#__PURE__*/React.createElement("div", {
    "data-dc-section": sid,
    style: {
      marginBottom: 'calc(80px * var(--dc-inv-zoom, 1))',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 60px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-sectionhead",
    style: {
      paddingBottom: 36
    }
  }, /*#__PURE__*/React.createElement(DCEditable, {
    tag: "div",
    value: sec.title ?? title,
    onChange: v => ctx && sid && ctx.patchSection(sid, {
      title: v
    }),
    style: {
      fontSize: 28,
      fontWeight: 600,
      color: DC.title,
      letterSpacing: -0.4,
      marginBottom: 6,
      display: 'inline-block'
    }
  }), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: DC.subtitle
    }
  }, subtitle))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap,
      padding: '0 60px',
      alignItems: 'flex-start',
      width: 'max-content'
    }
  }, order.map(k => /*#__PURE__*/React.createElement(DCArtboardFrame, {
    key: k,
    sectionId: sid,
    artboard: byId[k],
    order: order,
    label: (sec.labels || {})[k] ?? byId[k].props.label,
    onRename: v => ctx && ctx.patchSection(sid, x => ({
      labels: {
        ...x.labels,
        [k]: v
      }
    })),
    onReorder: next => ctx && ctx.patchSection(sid, {
      order: next
    }),
    onDelete: () => ctx && ctx.patchSection(sid, x => ({
      hidden: [...(x.srcKey === srcKey ? x.hidden || [] : []), k],
      srcKey
    })),
    onFocus: () => ctx && ctx.setFocus(`${sid}/${k}`)
  }))), rest);
}

// DCArtboard — marker; rendered by DCArtboardFrame via DCSection.
function DCArtboard() {
  return null;
}

// Per-artboard export (kind: 'png' | 'html'). Both paths share the same
// self-contained clone: computed styles baked in, @font-face / <img> /
// inline-style background-image urls inlined as data URIs. PNG wraps the
// clone in foreignObject→canvas at 3× the artboard's natural width×height
// (same pipeline the host uses for page captures); HTML wraps it in a
// minimal standalone document. Both are independent of viewport zoom.
async function dcExport(node, w, h, name, kind) {
  try {
    await document.fonts.ready;
  } catch {}
  const toDataURL = url => fetch(url).then(r => r.blob()).then(b => new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => res(url);
    fr.readAsDataURL(b);
  })).catch(() => url);

  // Collect @font-face rules. ss.cssRules throws SecurityError on
  // cross-origin sheets (e.g. fonts.googleapis.com) — in that case fetch
  // the CSS text directly (those endpoints send ACAO:*) and regex-extract
  // the blocks. @import and @media/@supports are walked so nested
  // @font-face rules aren't missed.
  const fontRules = [],
    pending = [],
    seen = new Set();
  const scrapeCss = href => {
    if (seen.has(href)) return;
    seen.add(href);
    pending.push(fetch(href).then(r => r.text()).then(css => {
      for (const m of css.match(/@font-face\s*{[^}]*}/g) || []) fontRules.push({
        css: m,
        base: href
      });
      for (const m of css.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)/g)) scrapeCss(new URL(m[1], href).href);
    }).catch(() => {}));
  };
  const walk = (rules, base) => {
    for (const r of rules) {
      if (r.type === CSSRule.FONT_FACE_RULE) fontRules.push({
        css: r.cssText,
        base
      });else if (r.type === CSSRule.IMPORT_RULE && r.styleSheet) {
        const ibase = r.styleSheet.href || base;
        try {
          walk(r.styleSheet.cssRules, ibase);
        } catch {
          scrapeCss(ibase);
        }
      } else if (r.cssRules) walk(r.cssRules, base);
    }
  };
  for (const ss of document.styleSheets) {
    const base = ss.href || location.href;
    try {
      walk(ss.cssRules, base);
    } catch {
      if (ss.href) scrapeCss(ss.href);
    }
  }
  while (pending.length) await pending.shift();
  const fontCss = (await Promise.all(fontRules.map(async rule => {
    let out = rule.css,
      m;
    const re = /url\((['"]?)([^'")]+)\1\)/g;
    while (m = re.exec(rule.css)) {
      if (m[2].indexOf('data:') === 0) continue;
      let abs;
      try {
        abs = new URL(m[2], rule.base).href;
      } catch {
        continue;
      }
      out = out.split(m[0]).join('url("' + (await toDataURL(abs)) + '")');
    }
    return out;
  }))).join('\n');
  const cloneStyled = src => {
    if (src.nodeType === 8 || src.nodeType === 1 && src.tagName === 'SCRIPT') return document.createTextNode('');
    const dst = src.cloneNode(false);
    if (src.nodeType === 1) {
      const cs = getComputedStyle(src);
      let txt = '';
      for (let i = 0; i < cs.length; i++) txt += cs[i] + ':' + cs.getPropertyValue(cs[i]) + ';';
      dst.setAttribute('style', txt + 'animation:none;transition:none;');
      if (src.tagName === 'CANVAS') try {
        const im = document.createElement('img');
        im.src = src.toDataURL();
        im.setAttribute('style', txt);
        return im;
      } catch {}
    }
    for (let c = src.firstChild; c; c = c.nextSibling) dst.appendChild(cloneStyled(c));
    return dst;
  };
  const clone = cloneStyled(node);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  // Drop the card's own shadow/radius so the export is a flush w×h rect;
  // the artboard's own background (if any) is already in the computed style.
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  const jobs = [];
  clone.querySelectorAll('img').forEach(el => {
    const s = el.getAttribute('src');
    if (s && s.indexOf('data:') !== 0) jobs.push(toDataURL(el.src).then(d => el.setAttribute('src', d)));
  });
  [clone, ...clone.querySelectorAll('*')].forEach(el => {
    const bg = el.style.backgroundImage;
    if (!bg) return;
    let m;
    const re = /url\(["']?([^"')]+)["']?\)/g;
    while (m = re.exec(bg)) {
      const tok = m[0],
        url = m[1];
      if (url.indexOf('data:') === 0) continue;
      jobs.push(toDataURL(url).then(d => {
        el.style.backgroundImage = el.style.backgroundImage.split(tok).join('url("' + d + '")');
      }));
    }
  });
  await Promise.all(jobs);
  const xml = new XMLSerializer().serializeToString(clone);
  const save = (blob, ext) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  if (kind === 'html') {
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + name + '</title>' + (fontCss ? '<style>' + fontCss + '</style>' : '') + '</head><body style="margin:0">' + xml + '</body></html>';
    return save(new Blob([html], {
      type: 'text/html'
    }), 'html');
  }

  // PNG: the SVG's own width/height must be the output resolution — an
  // <img>-loaded SVG rasterizes at its intrinsic size, so sizing it at 1×
  // and ctx.scale()-ing up would just upscale a 1× bitmap. viewBox maps the
  // w×h foreignObject onto the px·w × px·h SVG canvas so the browser renders
  // the HTML at full resolution.
  const px = 3;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w * px + '" height="' + h * px + '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject width="' + w + '" height="' + h + '">' + (fontCss ? '<style><![CDATA[' + fontCss + ']]></style>' : '') + xml + '</foreignObject></svg>';
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('svg load failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const cv = document.createElement('canvas');
  cv.width = w * px;
  cv.height = h * px;
  cv.getContext('2d').drawImage(img, 0, 0);
  cv.toBlob(blob => save(blob, 'png'), 'image/png');
}
function DCArtboardFrame({
  sectionId,
  artboard,
  label,
  order,
  onRename,
  onReorder,
  onFocus,
  onDelete
}) {
  const {
    id: rawId,
    label: rawLabel,
    width = 260,
    height = 480,
    children,
    style = {}
  } = artboard.props;
  const id = rawId ?? rawLabel;
  const ref = React.useRef(null);
  const cardRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  // ⋯ menu: close on any outside pointerdown. Two-click delete lives inside
  // the menu — first click arms the row, second commits; closing disarms.
  React.useEffect(() => {
    if (!menuOpen) {
      setConfirming(false);
      return;
    }
    const off = e => {
      if (!menuRef.current || !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [menuOpen]);
  const doExport = kind => {
    setMenuOpen(false);
    if (!cardRef.current) return;
    const name = String(label || id || 'artboard').replace(/[^\w\s.-]+/g, '_');
    dcExport(cardRef.current, width, height, name, kind).catch(e => console.error('[design-canvas] export failed:', e));
  };

  // Live drag-reorder: dragged card sticks to cursor; siblings slide into
  // their would-be slots in real time via transforms. DOM order only
  // changes on drop.
  const onGripDown = e => {
    e.preventDefault();
    e.stopPropagation();
    const me = ref.current;
    // translateX is applied in local (pre-scale) space but pointer deltas and
    // getBoundingClientRect().left are screen-space — divide by the viewport's
    // current scale so the dragged card tracks the cursor at any zoom level.
    const scale = me.getBoundingClientRect().width / me.offsetWidth || 1;
    const peers = Array.from(document.querySelectorAll(`[data-dc-section="${sectionId}"] [data-dc-slot]`));
    const homes = peers.map(el => ({
      el,
      id: el.dataset.dcSlot,
      x: el.getBoundingClientRect().left
    }));
    const slotXs = homes.map(h => h.x);
    const startIdx = order.indexOf(id);
    const startX = e.clientX;
    let liveOrder = order.slice();
    me.classList.add('dc-dragging');
    const layout = () => {
      for (const h of homes) {
        if (h.id === id) continue;
        const slot = liveOrder.indexOf(h.id);
        h.el.style.transform = `translateX(${(slotXs[slot] - h.x) / scale}px)`;
      }
    };
    const move = ev => {
      const dx = ev.clientX - startX;
      me.style.transform = `translateX(${dx / scale}px)`;
      const cur = homes[startIdx].x + dx;
      let nearest = 0,
        best = Infinity;
      for (let i = 0; i < slotXs.length; i++) {
        const d = Math.abs(slotXs[i] - cur);
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      if (liveOrder.indexOf(id) !== nearest) {
        liveOrder = order.filter(k => k !== id);
        liveOrder.splice(nearest, 0, id);
        layout();
      }
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const finalSlot = liveOrder.indexOf(id);
      me.classList.remove('dc-dragging');
      me.style.transform = `translateX(${(slotXs[finalSlot] - homes[startIdx].x) / scale}px)`;
      // After the settle transition, kill transitions + clear transforms +
      // commit the reorder in the same frame so there's no visual snap-back.
      setTimeout(() => {
        for (const h of homes) {
          h.el.style.transition = 'none';
          h.el.style.transform = '';
        }
        if (liveOrder.join('|') !== order.join('|')) onReorder(liveOrder);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          for (const h of homes) h.el.style.transition = '';
        }));
      }, 180);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    "data-dc-slot": id,
    style: {
      position: 'relative',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-header",
    style: {
      color: DC.label
    },
    onPointerDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-labelrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-grip",
    onPointerDown: onGripDown,
    title: "Drag to reorder"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "13",
    viewBox: "0 0 9 13",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "2",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "2",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "6.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "6.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "11",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "11",
    r: "1.1"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc-labeltext",
    onClick: onFocus,
    title: "Click to focus"
  }, /*#__PURE__*/React.createElement(DCEditable, {
    value: label,
    onChange: onRename,
    onClick: e => e.stopPropagation(),
    style: {
      fontSize: 15,
      fontWeight: 500,
      color: DC.label,
      lineHeight: 1
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc-btns"
  }, /*#__PURE__*/React.createElement("div", {
    ref: menuRef,
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "dc-kebab",
    title: "More",
    onClick: () => setMenuOpen(o => !o)
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "2.5",
    cy: "6",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "6",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9.5",
    cy: "6",
    r: "1.1"
  }))), menuOpen && /*#__PURE__*/React.createElement("div", {
    className: "dc-menu",
    onPointerDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => doExport('png')
  }, "Download PNG"), /*#__PURE__*/React.createElement("button", {
    onClick: () => doExport('html')
  }, "Download HTML"), /*#__PURE__*/React.createElement("hr", null), /*#__PURE__*/React.createElement("button", {
    className: "dc-danger",
    onClick: () => {
      if (confirming) {
        setMenuOpen(false);
        onDelete();
      } else setConfirming(true);
    }
  }, confirming ? 'Click again to delete' : 'Delete'))), /*#__PURE__*/React.createElement("button", {
    className: "dc-expand",
    onClick: onFocus,
    title: "Focus"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 1h4v4M5 11H1V7M11 1L7.5 4.5M1 11l3.5-3.5"
  }))))), /*#__PURE__*/React.createElement("div", {
    ref: cardRef,
    className: "dc-card",
    style: {
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06)',
      overflow: 'hidden',
      width,
      height,
      background: '#fff',
      ...style
    }
  }, children || /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#bbb',
      fontSize: 13,
      fontFamily: DC.font
    }
  }, id)));
}

// Inline rename — commits on blur or Enter.
function DCEditable({
  value,
  onChange,
  style,
  tag = 'span',
  onClick
}) {
  const T = tag;
  return /*#__PURE__*/React.createElement(T, {
    className: "dc-editable",
    contentEditable: true,
    suppressContentEditableWarning: true,
    onClick: onClick,
    onPointerDown: e => e.stopPropagation(),
    onBlur: e => onChange && onChange(e.currentTarget.textContent),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
    style: style
  }, value);
}

// ─────────────────────────────────────────────────────────────
// Focus mode — overlay one artboard; ←/→ within section, ↑/↓ across
// sections, Esc or backdrop click to exit.
// ─────────────────────────────────────────────────────────────
function DCFocusOverlay({
  entry,
  sectionMeta,
  sectionOrder
}) {
  const ctx = React.useContext(DCCtx);
  const {
    sectionId,
    artboard
  } = entry;
  const sec = ctx.section(sectionId);
  const meta = sectionMeta[sectionId];
  const peers = meta.slotIds;
  const aid = artboard.props.id ?? artboard.props.label;
  const idx = peers.indexOf(aid);
  const secIdx = sectionOrder.indexOf(sectionId);
  const go = d => {
    const n = peers[(idx + d + peers.length) % peers.length];
    if (n) ctx.setFocus(`${sectionId}/${n}`);
  };
  const goSection = d => {
    // Sections whose artboards are all deleted have slotIds:[] — step past
    // them to the next non-empty section so ↑/↓ doesn't dead-end.
    const n = sectionOrder.length;
    for (let i = 1; i < n; i++) {
      const ns = sectionOrder[((secIdx + d * i) % n + n) % n];
      const first = sectionMeta[ns] && sectionMeta[ns].slotIds[0];
      if (first) {
        ctx.setFocus(`${ns}/${first}`);
        return;
      }
    }
  };
  React.useEffect(() => {
    const k = e => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        goSection(-1);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goSection(1);
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });
  const {
    width = 260,
    height = 480,
    children
  } = artboard.props;
  const [vp, setVp] = React.useState({
    w: window.innerWidth,
    h: window.innerHeight
  });
  React.useEffect(() => {
    const r = () => setVp({
      w: window.innerWidth,
      h: window.innerHeight
    });
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  const scale = Math.max(0.1, Math.min((vp.w - 200) / width, (vp.h - 260) / height, 2));
  const [ddOpen, setDd] = React.useState(false);
  const Arrow = ({
    dir,
    onClick
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onClick();
    },
    style: {
      position: 'absolute',
      top: '50%',
      [dir]: 28,
      transform: 'translateY(-50%)',
      border: 'none',
      background: 'rgba(255,255,255,.08)',
      color: 'rgba(255,255,255,.9)',
      width: 44,
      height: 44,
      borderRadius: 22,
      fontSize: 18,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background .15s'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,.18)',
    onMouseLeave: e => e.currentTarget.style.background = 'rgba(255,255,255,.08)'
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: dir === 'left' ? 'M11 3L5 9l6 6' : 'M7 3l6 6-6 6'
  })));

  // Portal to body so position:fixed is the real viewport regardless of any
  // transform on DesignCanvas's ancestors (including the canvas zoom itself).
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    onClick: () => ctx.setFocus(null),
    onWheel: e => e.preventDefault(),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(24,20,16,.6)',
      backdropFilter: 'blur(14px)',
      fontFamily: DC.font,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      display: 'flex',
      alignItems: 'flex-start',
      padding: '16px 20px 0',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDd(o => !o),
    style: {
      border: 'none',
      background: 'transparent',
      color: '#fff',
      cursor: 'pointer',
      padding: '6px 8px',
      borderRadius: 6,
      textAlign: 'left',
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: -0.3
    }
  }, meta.title), /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 11 11",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    style: {
      opacity: .7
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 4l3.5 3.5L9 4"
  }))), meta.subtitle && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 13,
      opacity: .6,
      fontWeight: 400,
      marginTop: 2
    }
  }, meta.subtitle)), ddOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '100%',
      left: 0,
      marginTop: 4,
      background: '#2a251f',
      borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      padding: 4,
      minWidth: 200,
      zIndex: 10
    }
  }, sectionOrder.filter(sid => sectionMeta[sid].slotIds.length).map(sid => /*#__PURE__*/React.createElement("button", {
    key: sid,
    onClick: () => {
      setDd(false);
      const f = sectionMeta[sid].slotIds[0];
      if (f) ctx.setFocus(`${sid}/${f}`);
    },
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      border: 'none',
      cursor: 'pointer',
      background: sid === sectionId ? 'rgba(255,255,255,.1)' : 'transparent',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 5,
      fontSize: 14,
      fontWeight: sid === sectionId ? 600 : 400,
      fontFamily: 'inherit'
    }
  }, sectionMeta[sid].title)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => ctx.setFocus(null),
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,.12)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent',
    style: {
      border: 'none',
      background: 'transparent',
      color: 'rgba(255,255,255,.7)',
      width: 32,
      height: 32,
      borderRadius: 16,
      fontSize: 20,
      cursor: 'pointer',
      lineHeight: 1,
      transition: 'background .12s'
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 64,
      bottom: 56,
      left: 100,
      right: 100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: width * scale,
      height: height * scale,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      background: '#fff',
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: '0 20px 80px rgba(0,0,0,.4)'
    }
  }, children || /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#bbb'
    }
  }, aid))), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      fontSize: 14,
      fontWeight: 500,
      opacity: .85,
      textAlign: 'center'
    }
  }, (sec.labels || {})[aid] ?? artboard.props.label, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: .5,
      marginLeft: 10,
      fontVariantNumeric: 'tabular-nums'
    }
  }, idx + 1, " / ", peers.length))), /*#__PURE__*/React.createElement(Arrow, {
    dir: "left",
    onClick: () => go(-1)
  }), /*#__PURE__*/React.createElement(Arrow, {
    dir: "right",
    onClick: () => go(1)
  }), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 8
    }
  }, peers.map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => ctx.setFocus(`${sectionId}/${p}`),
    style: {
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      width: 6,
      height: 6,
      borderRadius: 3,
      background: i === idx ? '#fff' : 'rgba(255,255,255,.3)'
    }
  })))), document.body);
}

// ─────────────────────────────────────────────────────────────
// Post-it — absolute-positioned sticky note
// ─────────────────────────────────────────────────────────────
function DCPostIt({
  children,
  top,
  left,
  right,
  bottom,
  rotate = -2,
  width = 180
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width,
      background: DC.postitBg,
      padding: '14px 16px',
      fontFamily: '"Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
      fontSize: 14,
      lineHeight: 1.4,
      color: DC.postitText,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transform: `rotate(${rotate}deg)`,
      zIndex: 5
    }
  }, children);
}
Object.assign(window, {
  DesignCanvas,
  DCSection,
  DCArtboard,
  DCPostIt
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "banner/design-canvas.jsx", error: String((e && e.message) || e) }); }

// banner/phone-mocks.jsx
try { (() => {
// Mock phone screens for the announcement banner.
// Each is rendered inside a phone frame and built with Bluvi DS primitives.

const C = {
  indigo1: '#F0F3FD',
  indigo2: '#E0E7FF',
  indigo4: '#A5B4FC',
  indigo5: '#6366F1',
  indigo7: '#4338CA',
  green3: '#6BBAA3',
  green3_20: 'rgba(107,186,163,0.125)',
  green5: '#4CB944',
  green7: '#15803D',
  red1: '#FEE4E2',
  red5: '#F43F5E',
  red6: '#E11D48',
  yellow1_50: 'rgba(254,249,195,0.314)',
  yellow6: '#CA8A04',
  gray1: '#F2F2F2',
  gray2: '#E5E5E5',
  gray4: '#A3A3A3',
  gray5: '#737373',
  gray7: '#404040',
  gray10: '#262626'
};
const FONT = '"Nunito", -apple-system, system-ui, sans-serif';

// Tiny inline icons (kept lightweight; sized to phone scale)
const Ic = {
  pin: (s = 10, c = C.indigo5) => /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 20 20",
    fill: c
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2a6 6 0 016 6c0 4.5-6 10-6 10S4 12.5 4 8a6 6 0 016-6zm0 8a2 2 0 100-4 2 2 0 000 4z"
  })),
  check: (s = 10, c = '#fff') => /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 20 20",
    fill: c
  }, /*#__PURE__*/React.createElement("path", {
    d: "M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z"
  })),
  trophy: (s = 12, c = 'currentColor') => /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 4h8v3a4 4 0 11-8 0V4zM6 7H3v2a3 3 0 003 3M18 7h3v2a3 3 0 01-3 3M9 14v2a3 3 0 003 3 3 3 0 003-3v-2M8 21h8"
  })),
  scale: (s = 12, c = 'currentColor') => /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3v18M5 8l-3 6a4 4 0 008 0l-3-6M19 8l-3 6a4 4 0 008 0l-3-6M4 21h16"
  })),
  fish: (s = 12, c = 'currentColor') => /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: c
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 12c4-6 10-7 14-5l4-3v16l-4-3c-4 2-10 1-14-5zm14 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
  })),
  bell: (s = 14, c = '#000') => /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M15 17h5l-1.4-1.4A2 2 0 0118 14V11a6 6 0 10-12 0v3a2 2 0 01-.6 1.6L4 17h5m6 0a3 3 0 11-6 0"
  }))
};

// Status bar, dock, safe area paddings
function StatusBar({
  dark
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 30,
      padding: '8px 22px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: FONT,
      fontSize: 11,
      fontWeight: 700,
      color: c,
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "9",
    viewBox: "0 0 14 9",
    fill: c
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "6",
    width: "2.5",
    height: "3",
    rx: ".5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3.7",
    y: "4",
    width: "2.5",
    height: "5",
    rx: ".5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "7.4",
    y: "2",
    width: "2.5",
    height: "7",
    rx: ".5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "11.1",
    y: "0",
    width: "2.5",
    height: "9",
    rx: ".5"
  })), /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "10",
    viewBox: "0 0 20 10",
    fill: "none",
    stroke: c,
    strokeWidth: "1"
  }, /*#__PURE__*/React.createElement("rect", {
    x: ".5",
    y: ".5",
    width: "16",
    height: "9",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "13",
    height: "6",
    rx: ".8",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "17.5",
    y: "3",
    width: "1.5",
    height: "4",
    rx: ".5",
    fill: c
  }))));
}
function PhoneFrame({
  children,
  scale = 1
}) {
  const W = 320,
    H = 660;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: W * scale,
      height: H * scale,
      transformOrigin: 'top left',
      // outer hardware
      borderRadius: 44 * scale,
      background: '#0A0A0A',
      padding: 7 * scale,
      boxShadow: `
        0 ${30 * scale}px ${60 * scale}px -${10 * scale}px rgba(0,0,0,.35),
        0 ${10 * scale}px ${20 * scale}px -${5 * scale}px rgba(99,102,241,.18),
        inset 0 0 0 1px rgba(255,255,255,.05)
      `
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      borderRadius: 38 * scale,
      overflow: 'hidden',
      background: '#fff',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8 * scale,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 90 * scale,
      height: 24 * scale,
      background: '#000',
      borderRadius: 999,
      zIndex: 6
    }
  }), children));
}

// ===== Screen 1: Competition card focus + live ranking =====
function ScreenCompetition() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      background: '#fff',
      fontFamily: FONT,
      paddingTop: 46,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 18px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: .4
    }
  }, "SALUT,"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: C.gray10
    }
  }, "Andrei!")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, Ic.bell(20), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 8,
      height: 8,
      borderRadius: 999,
      background: C.red5,
      border: '2px solid #fff'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px 8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.gray10
    }
  }, "Concursuri live (3)"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.indigo5
    }
  }, "Vezi tot")), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 18px',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 5px 4px rgba(0,0,0,.18)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 130,
      background: `url(assets/competition.jpg) center/cover #777`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      right: 8,
      background: C.red6,
      color: '#fff',
      fontSize: 9,
      fontWeight: 700,
      padding: '3px 6px',
      borderRadius: 2,
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: 999,
      background: '#fff'
    }
  }), "LIVE"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      left: 8,
      background: C.indigo5,
      color: '#fff',
      fontSize: 9,
      fontWeight: 700,
      padding: '3px 5px',
      borderRadius: 2,
      display: 'flex',
      gap: 3,
      alignItems: 'center'
    }
  }, Ic.check(8), " Validat")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      padding: '10px 12px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: C.gray10,
      letterSpacing: .4
    }
  }, "12 NOIEMBRIE 2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.gray10,
      marginTop: 2
    }
  }, "Cupa Crapului"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3,
      alignItems: 'center',
      marginTop: 3
    }
  }, Ic.pin(10), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.indigo5
    }
  }, "Lacul Snagov")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: C.gray2,
      margin: '8px 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, [C.indigo4, C.green3, C.yellow6, C.red5].map((bg, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 18,
      height: 18,
      borderRadius: 999,
      background: bg,
      border: '2px solid #fff',
      marginLeft: i ? -6 : 0
    }
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: C.indigo5
    }
  }, "18/24 pescari")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      background: C.green3_20,
      color: C.green3,
      fontSize: 9,
      fontWeight: 700,
      padding: '2px 4px',
      borderRadius: 2
    }
  }, "Individual"), /*#__PURE__*/React.createElement("span", {
    style: {
      background: C.yellow1_50,
      color: C.yellow6,
      fontSize: 9,
      fontWeight: 700,
      padding: '2px 4px',
      borderRadius: 2
    }
  }, "Greutate total\u0103")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      margin: '14px 18px 0'
    }
  }, [{
    k: 'Pescari',
    v: '18/24'
  }, {
    k: 'Capturi',
    v: '126'
  }, {
    k: 'Premii',
    v: '2.4k lei'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      background: C.gray1,
      borderRadius: 10,
      padding: '10px 8px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: .3,
      textTransform: 'uppercase'
    }
  }, s.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.gray10,
      marginTop: 2
    }
  }, s.v)))));
}

// ===== Screen 2: Rankings list =====
function ScreenRankings() {
  const rows = [{
    p: 1,
    name: 'Mihai Ionescu',
    kg: '12.4 kg',
    av: C.indigo5,
    accent: C.yellow6
  }, {
    p: 2,
    name: 'Andrei Popescu',
    kg: '10.8 kg',
    av: C.green3,
    accent: C.gray5
  }, {
    p: 3,
    name: 'Ștefan Vasilescu',
    kg: '9.2 kg',
    av: C.yellow6,
    accent: '#B45309'
  }, {
    p: 4,
    name: 'Cosmin Marin',
    kg: '7.5 kg',
    av: C.red5,
    accent: C.gray10
  }, {
    p: 5,
    name: 'Radu Dumitrescu',
    kg: '6.9 kg',
    av: C.indigo4,
    accent: C.gray10
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      background: '#fff',
      fontFamily: FONT,
      paddingTop: 46,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 120,
      position: 'relative',
      background: `url(assets/lake.jpeg) center/cover #777`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(0,0,0,.25) 0%, transparent 40%, rgba(0,0,0,.6) 100%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      right: 14,
      background: C.red6,
      color: '#fff',
      fontSize: 9,
      fontWeight: 700,
      padding: '3px 6px',
      borderRadius: 2,
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: 999,
      background: '#fff'
    }
  }), "LIVE"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 10,
      left: 14,
      right: 14,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      opacity: .9,
      letterSpacing: .4
    }
  }, "12 NOIEMBRIE 2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      marginTop: 2
    }
  }, "Cupa Crapului"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3,
      alignItems: 'center',
      marginTop: 2
    }
  }, Ic.pin(10, '#fff'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700
    }
  }, "Lacul Snagov")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.gray10,
      marginBottom: 10
    }
  }, "Clasament live"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, rows.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.p,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      background: '#fff',
      borderRadius: 10,
      boxShadow: '0 1px 2px rgba(0,0,0,.08)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: 700,
      color: r.accent
    }
  }, "#", r.p), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 26,
      height: 26,
      borderRadius: 999,
      background: r.av,
      opacity: .9
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 12,
      fontWeight: 600,
      color: C.gray10
    }
  }, r.name), /*#__PURE__*/React.createElement("span", {
    style: {
      background: C.indigo1,
      color: C.indigo5,
      fontSize: 10,
      fontWeight: 700,
      padding: '2.5px 5px',
      borderRadius: 2
    }
  }, r.kg))))));
}

// ===== Screen 3: Dashboard / stats overview =====
function ScreenStats() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      background: '#fff',
      fontFamily: FONT,
      paddingTop: 46,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '4px 14px 0',
      padding: 10,
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 2px 10px rgba(99,102,241,.18)',
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 10,
      background: `url(assets/bluvi_horizontal.png) center/contain no-repeat ${C.indigo1}`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.gray10
    }
  }, "Salut, Andrei!"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: C.gray5,
      marginTop: 2,
      lineHeight: 1.3
    }
  }, "Capturi mari, pove\u0219ti \u0219i mai mari.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, Ic.bell(16), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -1,
      right: -1,
      width: 6,
      height: 6,
      borderRadius: 999,
      background: C.red5,
      border: '1.5px solid #fff'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '12px 14px 0',
      padding: 14,
      borderRadius: 14,
      background: `linear-gradient(135deg, ${C.indigo7} 0%, ${C.indigo5} 100%)`,
      color: '#fff',
      boxShadow: '0 5px 14px rgba(99,102,241,.4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      opacity: .8,
      letterSpacing: .4
    }
  }, "SEZONUL ACESTA"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 4,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 28,
      fontWeight: 800,
      lineHeight: 1
    }
  }, "1.284"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      opacity: .9
    }
  }, "kg")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      opacity: .9,
      marginTop: 3
    }
  }, "capturate la 42 concursuri"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 4,
      height: 30,
      marginTop: 10
    }
  }, [40, 55, 38, 72, 48, 90, 62, 80, 50, 70, 58, 85].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: `${h}%`,
      background: 'rgba(255,255,255,.7)',
      borderRadius: '2px 2px 0 0'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '12px 14px 0',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, [{
    k: 'Pescari activi',
    v: '2.413',
    c: C.indigo5
  }, {
    k: 'Bălți',
    v: '124',
    c: C.gray10
  }, {
    k: 'Concursuri',
    v: '42',
    c: C.green7
  }, {
    k: 'Capturi totale',
    v: '8.7k',
    c: C.yellow6
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: C.gray1,
      borderRadius: 10,
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 8,
      fontWeight: 700,
      color: C.gray5,
      letterSpacing: .4,
      textTransform: 'uppercase'
    }
  }, s.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: s.c,
      marginTop: 2
    }
  }, s.v)))));
}
Object.assign(window, {
  PhoneFrame,
  ScreenCompetition,
  ScreenRankings,
  ScreenStats,
  BluviC: C
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "banner/phone-mocks.jsx", error: String((e && e.message) || e) }); }

// chat/ChatSheet.jsx
try { (() => {
// Bluvi — Competition chat sheet. Two tabs: "Toată lumea" and "Participanți".
// Uses Bluvi tokens from window.C/TYPE. Original messaging UI — not a recreation of any branded app.

const {
  C,
  TYPE,
  Icons,
  Badge
} = window;

// ─── Sample data ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = [C.indigo5, C.green3, C.yellow6, C.red5, C.cyan6, C.indigo7, C.gray7, '#B45309'];
function avatarColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 999;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name) {
  return name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
}
const MESSAGES_ALL = [{
  kind: 'system',
  text: 'Bun venit la discuția Cupa Crapului!'
}, {
  kind: 'day',
  text: 'IERI'
}, {
  kind: 'in',
  author: 'Andrei P.',
  body: 'Cine e gata pentru sâmbătă? 🎣 mă-ntreb dacă să iau și feeder-ul scurt.',
  time: '18:42'
}, {
  kind: 'in',
  author: 'Cosmin M.',
  body: 'Eu sigur. Aduc rod-ul nou, sper să prindă crap mare.',
  time: '18:44'
}, {
  kind: 'out',
  body: 'Și eu am bilet. Ne vedem la stăvilarul nordic?',
  time: '18:51',
  status: 'read'
}, {
  kind: 'in',
  author: 'Ștefan V.',
  body: 'Cineva știe dacă se permite pescuit nocturn?',
  time: '19:03'
}, {
  kind: 'in',
  author: 'Mihai I.',
  role: 'Organizator',
  body: 'Da, de vineri seara. Detalii în regulament.',
  time: '19:05'
}, {
  kind: 'day',
  text: 'ASTĂZI'
}, {
  kind: 'system',
  text: 'Maria S. s-a alăturat concursului'
}, {
  kind: 'in',
  author: 'Andrei P.',
  body: 'Bun venit, Maria! Pe ce stand ești?',
  time: '09:12'
}, {
  kind: 'in',
  author: 'Maria S.',
  body: 'Salut! Pe 7, lângă pădure.',
  time: '09:14'
}, {
  kind: 'out',
  body: 'Eu sunt pe 9, vecini! 🎣',
  time: '09:18',
  status: 'read'
}, {
  kind: 'in',
  author: 'Cosmin M.',
  body: 'Stăviliți momeala bună, văd că prinde greu zilele astea.',
  time: '09:22'
}];
const MESSAGES_PARTI = [{
  kind: 'system',
  text: 'Doar pescarii înscriși pot scrie aici'
}, {
  kind: 'day',
  text: 'ASTĂZI'
}, {
  kind: 'in',
  author: 'Mihai I.',
  role: 'Organizator',
  body: 'Înscrierile se închid joi la 20:00. Standurile se distribuie vineri dimineață.',
  time: '08:30'
}, {
  kind: 'in',
  author: 'Mihai I.',
  role: 'Organizator',
  body: 'Atenție: nivelul apei a crescut cu 20cm, fundul s-a schimbat.',
  time: '08:31'
}, {
  kind: 'in',
  author: 'Cosmin M.',
  body: 'Mulțumesc! Cineva vrea să împărțim transportul din București?',
  time: '10:04'
}, {
  kind: 'out',
  body: 'Eu vin din Pipera, plec vineri la 16:00. Două locuri libere.',
  time: '10:09',
  status: 'read'
}, {
  kind: 'in',
  author: 'Andrei P.',
  body: 'Vin cu tine, mersi mult! Îți scriu pe privat.',
  time: '10:11'
}, {
  kind: 'in',
  author: 'Ștefan V.',
  body: 'Pot ajunge eu cu mașina pentru cei din Otopeni — 3 locuri.',
  time: '10:18'
}, {
  kind: 'out',
  body: 'Super, fac un thread separat cu transportul.',
  time: '10:20',
  status: 'sent'
}];

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Avatar({
  name,
  size = 32
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: 999,
      background: avatarColor(name),
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Nunito',
      fontWeight: 700,
      fontSize: Math.round(size * 0.36),
      flex: '0 0 auto'
    }
  }, initials(name));
}
function Check({
  double,
  color
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "11",
    viewBox: "0 0 22 12",
    fill: "none",
    style: {
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 6.5L5 10.5L13.5 2",
    stroke: color,
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), double && /*#__PURE__*/React.createElement("path", {
    d: "M8 10.5L9.2 10.5L17.5 2",
    stroke: color,
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
function DayDivider({
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '10px 0 6px',
      padding: '0 4px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: C.gray2
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.helper2,
      color: C.gray5,
      letterSpacing: '.08em'
    }
  }, text), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: C.gray2
    }
  }));
}
function SystemMsg({
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      margin: '2px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.helper2,
      color: C.gray5,
      background: C.gray1,
      borderRadius: 999,
      padding: '5px 12px',
      textAlign: 'center'
    }
  }, text));
}
function InBubble({
  msg,
  showAvatar,
  shape,
  accent
}) {
  const r = shape === 'soft' ? '14px 14px 14px 4px' : '12px';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'flex-end',
      maxWidth: '82%',
      alignSelf: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      opacity: showAvatar ? 1 : 0
    }
  }, showAvatar && /*#__PURE__*/React.createElement(Avatar, {
    name: msg.author
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      borderRadius: r,
      padding: '8px 12px 6px',
      boxShadow: '0 1px 2px rgba(10,10,10,.08)',
      border: `1px solid ${C.gray2}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 0
    }
  }, showAvatar && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.helper2,
      color: accent,
      fontWeight: 800
    }
  }, msg.author), msg.role && /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.helper2,
      fontSize: 10,
      lineHeight: '12px',
      background: accent,
      color: '#fff',
      borderRadius: 2,
      padding: '1.5px 4px'
    }
  }, msg.role)), /*#__PURE__*/React.createElement("div", {
    style: {
      ...TYPE.body2,
      color: C.gray10,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }
  }, msg.body), /*#__PURE__*/React.createElement("div", {
    style: {
      ...TYPE.helper2,
      fontSize: 10,
      color: C.gray5,
      alignSelf: 'flex-end',
      marginTop: 2
    }
  }, msg.time)));
}
function OutBubble({
  msg,
  shape,
  accent
}) {
  const r = shape === 'soft' ? '14px 14px 4px 14px' : '12px';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: accent,
      color: '#fff',
      borderRadius: r,
      padding: '8px 12px 6px',
      maxWidth: '78%',
      alignSelf: 'flex-end',
      boxShadow: '0 2px 6px rgba(99,102,241,.25)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...TYPE.body2,
      color: '#fff',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }
  }, msg.body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-end',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.helper2,
      fontSize: 10,
      color: 'rgba(255,255,255,.85)'
    }
  }, msg.time), /*#__PURE__*/React.createElement(Check, {
    double: msg.status === 'read',
    color: msg.status === 'read' ? '#fff' : 'rgba(255,255,255,.7)'
  })));
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
function ChatSheet({
  open,
  onClose,
  comp,
  bubbleShape = 'soft',
  accent = C.indigo5,
  density = 'comfortable'
}) {
  const [tab, setTab] = React.useState('all'); // 'all' | 'parti'
  const [draft, setDraft] = React.useState('');
  const scrollRef = React.useRef(null);

  // Show messages
  const msgs = tab === 'all' ? MESSAGES_ALL : MESSAGES_PARTI;

  // Auto scroll to bottom when tab/open changes
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
    return () => clearTimeout(t);
  }, [open, tab]);
  const tabRow = /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      padding: '10px 14px 12px',
      background: '#fff',
      borderBottom: `1px solid ${C.gray2}`
    }
  }, [{
    key: 'all',
    label: 'Toată lumea',
    count: 124
  }, {
    key: 'parti',
    label: 'Participanți',
    count: 18
  }].map(t => {
    const on = tab === t.key;
    return /*#__PURE__*/React.createElement("button", {
      key: t.key,
      onClick: () => setTab(t.key),
      style: {
        flex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 10,
        cursor: 'pointer',
        background: on ? accent : C.gray1,
        color: on ? '#fff' : C.gray10,
        border: 0,
        ...TYPE.helper,
        fontWeight: 700,
        transition: 'background .15s, color .15s'
      }
    }, /*#__PURE__*/React.createElement("span", null, t.label), /*#__PURE__*/React.createElement("span", {
      style: {
        ...TYPE.helper2,
        fontSize: 10,
        lineHeight: '14px',
        background: on ? 'rgba(255,255,255,.22)' : '#fff',
        color: on ? '#fff' : C.gray5,
        borderRadius: 999,
        padding: '1px 7px',
        minWidth: 18,
        textAlign: 'center'
      }
    }, t.count));
  }));

  // Compute showAvatar — true on first message from author in a run
  const rendered = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const prev = msgs[i - 1];
    const showAvatar = m.kind === 'in' && (!prev || prev.kind !== 'in' || prev.author !== m.author);
    rendered.push({
      m,
      showAvatar
    });
  }
  const messageGap = density === 'cozy' ? 4 : 8;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: open ? 'auto' : 'none',
      zIndex: 60
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(10,10,10,.35)',
      opacity: open ? 1 : 0,
      transition: 'opacity .25s ease-out'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '92%',
      background: '#fff',
      borderRadius: '20px 20px 0 0',
      boxShadow: '0 -10px 30px rgba(0,0,0,.18)',
      display: 'flex',
      flexDirection: 'column',
      transform: open ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform .32s cubic-bezier(.22,1.2,.36,1)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      padding: '8px 0 4px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 4,
      background: C.gray2,
      borderRadius: 999
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '4px 14px 10px',
      borderBottom: `1px solid ${C.gray2}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: 36,
      height: 36,
      borderRadius: 999,
      border: 0,
      background: C.gray1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icons.ChevronLeft, {
    size: 20,
    color: C.gray10
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 10,
      overflow: 'hidden',
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: comp.image,
    alt: "",
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...TYPE.heading2,
      color: C.gray10,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, comp.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: C.green5
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.helper2,
      color: C.gray5
    }
  }, "32 pescari online"))), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 999,
      border: 0,
      background: 'transparent',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: C.gray10,
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "5",
    r: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "19",
    r: "1.5"
  })))), tabRow, /*#__PURE__*/React.createElement("div", {
    ref: scrollRef,
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: messageGap,
      background: '#FAFAFA'
    }
  }, rendered.map(({
    m,
    showAvatar
  }, i) => {
    if (m.kind === 'day') return /*#__PURE__*/React.createElement(DayDivider, {
      key: i,
      text: m.text
    });
    if (m.kind === 'system') return /*#__PURE__*/React.createElement(SystemMsg, {
      key: i,
      text: m.text
    });
    if (m.kind === 'in') return /*#__PURE__*/React.createElement(InBubble, {
      key: i,
      msg: m,
      showAvatar: showAvatar,
      shape: bubbleShape,
      accent: accent
    });
    if (m.kind === 'out') return /*#__PURE__*/React.createElement(OutBubble, {
      key: i,
      msg: m,
      shape: bubbleShape,
      accent: accent
    });
    return null;
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px 14px',
      background: '#fff',
      borderTop: `1px solid ${C.gray2}`,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    title: "Ata\u0219eaz\u0103",
    style: {
      width: 38,
      height: 38,
      borderRadius: 999,
      border: 0,
      background: C.gray1,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: C.gray10,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: C.gray1,
      borderRadius: 999,
      padding: '8px 14px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    placeholder: tab === 'all' ? 'Scrie un mesaj…' : 'Scrie participanților…',
    style: {
      flex: 1,
      border: 0,
      background: 'transparent',
      outline: 'none',
      ...TYPE.body,
      color: C.gray10
    }
  }), /*#__PURE__*/React.createElement("button", {
    title: "Emoji",
    style: {
      border: 0,
      background: 'transparent',
      padding: 0,
      cursor: 'pointer',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: C.gray5,
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "10",
    r: ".8",
    fill: C.gray5
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "10",
    r: ".8",
    fill: C.gray5
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 14.5a4 4 0 007 0"
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDraft(''),
    style: {
      width: 42,
      height: 42,
      borderRadius: 999,
      border: 0,
      background: draft.trim() ? accent : C.indigo4,
      color: '#fff',
      cursor: draft.trim() ? 'pointer' : 'default',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(99,102,241,.3)',
      transition: 'background .15s'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "#fff"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 11.5L21 3l-7 18-3-8-8-1.5z"
  }))))));
}
Object.assign(window, {
  ChatSheet,
  ChatAvatar: Avatar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "chat/ChatSheet.jsx", error: String((e && e.message) || e) }); }

// chat/tweaks-panel.jsx
try { (() => {
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  noDeckControls = false,
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  // Auto-inject a rail toggle when a <deck-stage> is on the page. The
  // toggle drives the deck's per-viewer _railVisible via window message;
  // state is mirrored from the same localStorage key the deck reads so
  // the control reflects reality across reloads. The mechanism is the
  // message — authors who want custom placement can post it directly
  // and pass noDeckControls to suppress this one.
  const hasDeckStage = React.useMemo(() => typeof document !== 'undefined' && !!document.querySelector('deck-stage'), []);
  // deck-stage enables its rail in connectedCallback, but this panel can
  // mount before that element has upgraded. The initial read catches the
  // common case; the listener covers mounting first. (Older deck-stage.js
  // copies still wait for the host's __omelette_rail_enabled postMessage —
  // same listener handles those.)
  const [railEnabled, setRailEnabled] = React.useState(() => hasDeckStage && !!document.querySelector('deck-stage')?._railEnabled);
  React.useEffect(() => {
    if (!hasDeckStage || railEnabled) return undefined;
    const onMsg = e => {
      if (e.data && e.data.type === '__omelette_rail_enabled') setRailEnabled(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [hasDeckStage, railEnabled]);
  const [railVisible, setRailVisible] = React.useState(() => {
    try {
      return localStorage.getItem('deck-stage.railVisible') !== '0';
    } catch (e) {
      return true;
    }
  });
  const toggleRail = on => {
    setRailVisible(on);
    window.postMessage({
      type: '__deck_rail_visible',
      on
    }, '*');
  };
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-noncommentable": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children, hasDeckStage && railEnabled && !noDeckControls && /*#__PURE__*/React.createElement(TweakSection, {
    label: "Deck"
  }, /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Thumbnail rail",
    value: railVisible,
    onChange: toggleRail
  })))));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "chat/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/AppScreens.jsx
try { (() => {
// Bluvi mobile — Dashboard + Competition + Lake screens.
// References: app/(app)/(tabs)/index.tsx, components/CompetitionCard.tsx, CardWithImageHeader.tsx
// Read shared assets off window (each Babel <script> is its own scope).
const {
  PHOTO_LAKE,
  PHOTO_COMP,
  PHOTO_BIG,
  LOGO_BLUVI
} = window;
const {
  C,
  TYPE,
  Text,
  Button,
  Badge,
  Card,
  Icons,
  LiveDot
} = window;
function ProfileGreetCard({
  name = 'Andrei',
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      margin: '0 -5px',
      padding: 12,
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 2px 10px rgba(99,102,241,.15)',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: LOGO_BLUVI,
    style: {
      width: 70,
      height: 70,
      borderRadius: 12,
      objectFit: 'cover'
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "heading1",
    style: {
      lineHeight: '24px'
    }
  }, "Salut, ", name, "!"), /*#__PURE__*/React.createElement(Text, {
    preset: "helper",
    color: C.gray5,
    style: {
      lineHeight: '16px'
    }
  }, "Capturi mari, pove\u0219ti \u0219i mai mari. \xCEmp\u0103rt\u0103\u0219e\u0219te-\u021Bi aventura!")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      padding: 6
    }
  }, /*#__PURE__*/React.createElement(Icons.Bell, {
    size: 24,
    color: "#000"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 10,
      height: 10,
      borderRadius: 999,
      background: C.red5,
      border: '2px solid #fff'
    }
  })));
}
function SectionTitle({
  title,
  count,
  action,
  onAction
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      margin: '8px 0 0'
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "heading1"
  }, title, count != null ? ` (${count})` : ''), action && /*#__PURE__*/React.createElement("span", {
    onClick: onAction,
    style: {
      ...TYPE.helper,
      color: C.indigo5,
      cursor: 'pointer'
    }
  }, action));
}
function CompetitionCard({
  comp,
  onClick
}) {
  return /*#__PURE__*/React.createElement(Card, {
    onClick: onClick,
    style: {
      width: 280,
      overflow: 'hidden',
      flex: '0 0 280px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 140
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: comp.image,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: '10px 10px 0 0'
    },
    alt: ""
  }), comp.live && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      right: 8
    }
  }, /*#__PURE__*/React.createElement(LiveDot, null)), comp.validated && /*#__PURE__*/React.createElement(Badge, {
    color: "solidIndigo",
    icon: /*#__PURE__*/React.createElement(Icons.Check, {
      color: "#fff"
    }),
    style: {
      position: 'absolute',
      top: 8,
      left: 8
    }
  }, "Validat")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 10px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "helper2",
    color: C.gray10
  }, comp.date.toUpperCase()), /*#__PURE__*/React.createElement(Text, {
    preset: "heading2",
    style: {
      marginBottom: 2
    }
  }, comp.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icons.MapPin, {
    color: C.indigo5,
    size: 12
  }), /*#__PURE__*/React.createElement(Text, {
    preset: "body",
    color: C.indigo5,
    style: {
      fontWeight: 700
    }
  }, comp.lake)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: C.gray2,
      margin: '8px 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, ['#A5B4FC', '#6BBAA3', '#EAB308', '#F43F5E'].map((bg, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 26,
      height: 26,
      borderRadius: 999,
      background: bg,
      border: '2px solid #fff',
      marginLeft: i ? -8 : 0
    }
  }))), /*#__PURE__*/React.createElement(Text, {
    preset: "helper2",
    color: C.indigo5
  }, comp.participants, "/", comp.limit, " pescari")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    color: "green"
  }, comp.type), /*#__PURE__*/React.createElement(Badge, {
    color: "yellow"
  }, comp.ranking)), comp.fee != null && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: C.gray2,
      margin: '8px 0 4px'
    }
  }), /*#__PURE__*/React.createElement(Text, {
    preset: "helper",
    color: C.gray5,
    style: {
      fontWeight: 600
    }
  }, "Tax\u0103 de \xEEnscriere:"), /*#__PURE__*/React.createElement(Text, {
    preset: "heading1"
  }, comp.fee ? `${comp.fee} lei` : 'Gratuit'))));
}
function MiniLakeCard({
  lake,
  onClick
}) {
  return /*#__PURE__*/React.createElement(Card, {
    onClick: onClick,
    style: {
      width: 225,
      flex: '0 0 225px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: lake.image,
    style: {
      width: '100%',
      height: 135,
      objectFit: 'cover',
      borderRadius: '10px 10px 0 0'
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "heading2"
  }, lake.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icons.MapPin, {
    color: C.indigo5,
    size: 12
  }), /*#__PURE__*/React.createElement(Text, {
    preset: "helper2",
    color: C.indigo5
  }, lake.location)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icons.Star, {
    size: 14,
    filled: true
  }), /*#__PURE__*/React.createElement(Text, {
    preset: "helper2",
    color: C.gray10
  }, lake.rating, " \xB7 ", lake.reviews, " recenzii"))));
}
function LakeRequestBanner() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.indigo1,
      borderRadius: 10,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "heading2",
    color: C.indigo7
  }, "Nu g\u0103se\u0219ti balta preferat\u0103?"), /*#__PURE__*/React.createElement(Text, {
    preset: "body2",
    color: C.gray10
  }, "Sugereaz\u0103-ne o balt\u0103 care lipseste \u0219i o vom ad\u0103uga \xEEn aplica\u021Bie!"), /*#__PURE__*/React.createElement(Button, {
    preset: "outlined",
    style: {
      alignSelf: 'flex-start',
      padding: '8px 14px'
    }
  }, "Sugereaz\u0103 balt\u0103"));
}
function HorizontalList({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      overflowX: 'auto',
      alignItems: 'flex-start',
      margin: '0 -20px',
      padding: '4px 20px 12px',
      scrollbarWidth: 'none'
    }
  }, /*#__PURE__*/React.createElement("style", null, `div::-webkit-scrollbar{display:none}`), children);
}
function DashboardScreen({
  onOpenComp,
  onOpenLake
}) {
  const liveComps = [{
    id: 1,
    name: 'Cupa Crapului',
    date: '12 noiembrie 2026',
    lake: 'Lacul Snagov',
    image: PHOTO_COMP,
    participants: 18,
    limit: 24,
    type: 'Individual',
    ranking: 'Greutate totală',
    live: true,
    validated: true
  }, {
    id: 2,
    name: 'Concurs Feeder',
    date: '15 noiembrie 2026',
    lake: 'Lacul Mostiștea',
    image: PHOTO_LAKE,
    participants: 12,
    limit: 30,
    type: 'Echipe',
    ranking: 'Cel mai mare pește',
    fee: 120
  }];
  const lakes = [{
    id: 1,
    name: 'Snagov',
    location: 'Ilfov',
    rating: 4.6,
    reviews: 124,
    image: PHOTO_LAKE
  }, {
    id: 2,
    name: 'Mostiștea',
    location: 'Călărași',
    rating: 4.4,
    reviews: 88,
    image: PHOTO_LAKE
  }, {
    id: 3,
    name: 'Cernica',
    location: 'Ilfov',
    rating: 4.2,
    reviews: 53,
    image: PHOTO_COMP
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      background: '#fff',
      padding: '56px 20px 100px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement(ProfileGreetCard, null), /*#__PURE__*/React.createElement(SectionTitle, {
    title: "Concursuri live",
    count: 3,
    action: "Vezi tot"
  }), /*#__PURE__*/React.createElement(HorizontalList, null, liveComps.map(c => /*#__PURE__*/React.createElement(CompetitionCard, {
    key: c.id,
    comp: c,
    onClick: () => onOpenComp?.(c)
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      background: `linear-gradient(135deg, ${C.indigo7} 0%, ${C.indigo5} 100%)`,
      padding: 16,
      color: '#fff',
      boxShadow: '0 5px 12px rgba(99,102,241,.35)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Text, {
    preset: "helper2",
    style: {
      color: '#fff',
      opacity: .85
    }
  }, "BLUVI & PESCARMANIA")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "heading1",
    style: {
      color: '#fff',
      fontSize: 22
    }
  }, "Tragere la sor\u021Bi Expo 2026")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "body2",
    style: {
      color: '#fff',
      opacity: .9
    }
  }, "Particip\u0103 \u0219i c\xE2\u0219tig\u0103 echipamente de pescuit!")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 12
    }
  }, [{
    n: '09',
    l: 'ZILE'
  }, {
    n: '14',
    l: 'ORE'
  }, {
    n: '23',
    l: 'MIN'
  }].map((u, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: 'rgba(255,255,255,.2)',
      borderRadius: 8,
      padding: '6px 10px',
      textAlign: 'center',
      minWidth: 48
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Text, {
    preset: "heading1",
    style: {
      color: '#fff',
      fontSize: 18,
      lineHeight: '20px'
    }
  }, u.n)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Text, {
    preset: "helper2",
    style: {
      color: '#fff',
      opacity: .8,
      fontSize: 9
    }
  }, u.l))))), /*#__PURE__*/React.createElement(Button, {
    preset: "secondary",
    style: {
      marginTop: 12,
      width: '100%',
      color: C.indigo5
    }
  }, "\xCEnscrie-te la tombol\u0103")), /*#__PURE__*/React.createElement(SectionTitle, {
    title: "B\u0103l\u021Bi",
    count: 24,
    action: "Vezi tot"
  }), /*#__PURE__*/React.createElement(HorizontalList, null, lakes.map(l => /*#__PURE__*/React.createElement(MiniLakeCard, {
    key: l.id,
    lake: l,
    onClick: () => onOpenLake?.(l)
  }))), /*#__PURE__*/React.createElement(LakeRequestBanner, null), /*#__PURE__*/React.createElement(SectionTitle, {
    title: "Sponsori"
  }), /*#__PURE__*/React.createElement(HorizontalList, null, [1, 2, 3].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 200,
      height: 120,
      borderRadius: 10,
      flex: '0 0 200px',
      background: i === 1 ? `url(${PHOTO_BIG}) center/contain no-repeat ${C.gray1}` : C.gray1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: C.gray5,
      ...TYPE.helper2
    }
  }, i !== 1 && 'SPONSOR ' + i))));
}

// ───── Competition Detail ─────
function CompetitionDetailScreen({
  comp,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 240
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: comp.image,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(0,0,0,.35) 0%, transparent 30%, transparent 60%, rgba(0,0,0,.5) 100%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    onClick: onBack,
    style: {
      position: 'absolute',
      top: 50,
      left: 14,
      width: 40,
      height: 40,
      borderRadius: 999,
      background: 'rgba(255,255,255,.92)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icons.ChevronLeft, {
    size: 22,
    color: "#000"
  })), comp.live && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 55,
      right: 14
    }
  }, /*#__PURE__*/React.createElement(LiveDot, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 14,
      left: 14,
      right: 14,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.helper2,
      opacity: .9
    }
  }, comp.date.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    style: {
      ...TYPE.heading1,
      fontSize: 22,
      color: '#fff',
      marginTop: 4
    }
  }, comp.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'center',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Icons.MapPin, {
    color: "#fff",
    size: 12
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.body,
      color: '#fff',
      fontWeight: 700
    }
  }, comp.lake)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    color: "green"
  }, comp.type), /*#__PURE__*/React.createElement(Badge, {
    color: "yellow"
  }, comp.ranking), comp.validated && /*#__PURE__*/React.createElement(Badge, {
    color: "indigo",
    icon: /*#__PURE__*/React.createElement(Icons.Check, {
      color: C.indigo5
    })
  }, "Validat")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.gray1,
      borderRadius: 10,
      padding: 14,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Text, {
    preset: "helper",
    color: C.gray5,
    style: {
      fontWeight: 600
    }
  }, "Pescari \xEEnscri\u0219i"), /*#__PURE__*/React.createElement(Text, {
    preset: "heading1"
  }, comp.participants, /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.body,
      color: C.gray5
    }
  }, "/", comp.limit))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Text, {
    preset: "helper",
    color: C.gray5,
    style: {
      fontWeight: 600
    }
  }, "Tax\u0103"), /*#__PURE__*/React.createElement(Text, {
    preset: "heading1"
  }, comp.fee ? `${comp.fee} lei` : 'Gratuit'))), /*#__PURE__*/React.createElement(Text, {
    preset: "heading2"
  }, "Clasament live"), [{
    p: 1,
    name: 'Mihai I.',
    kg: '12.4 kg',
    av: C.indigo5
  }, {
    p: 2,
    name: 'Andrei P.',
    kg: '10.8 kg',
    av: C.green3
  }, {
    p: 3,
    name: 'Ștefan V.',
    kg: '9.2 kg',
    av: C.yellow6
  }, {
    p: 4,
    name: 'Cosmin M.',
    kg: '7.5 kg',
    av: C.red5
  }].map(r => /*#__PURE__*/React.createElement("div", {
    key: r.p,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 12px',
      background: '#fff',
      borderRadius: 10,
      boxShadow: '0 1px 2px rgba(0,0,0,.06)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      textAlign: 'center',
      ...TYPE.heading2,
      color: r.p === 1 ? C.yellow6 : r.p === 2 ? C.gray5 : r.p === 3 ? '#B45309' : C.gray10
    }
  }, "#", r.p), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 999,
      background: r.av,
      opacity: .85
    }
  }), /*#__PURE__*/React.createElement(Text, {
    preset: "body",
    style: {
      flex: 1
    }
  }, r.name), /*#__PURE__*/React.createElement(Badge, {
    color: "indigo"
  }, r.kg))), /*#__PURE__*/React.createElement(Button, {
    style: {
      width: '100%'
    }
  }, "\xCEnscrie-te la concurs"), /*#__PURE__*/React.createElement(Button, {
    preset: "outlined",
    style: {
      width: '100%'
    }
  }, "Vezi clasament complet")));
}

// ───── Lakes List ─────
function LakesListScreen({
  onOpen
}) {
  const [filter, setFilter] = React.useState('Toate');
  const filters = ['Toate', 'Aproape', 'Top rated', 'Crap', 'Răpitor'];
  const lakes = [{
    id: 1,
    name: 'Lacul Snagov',
    location: 'Ilfov, 32 km',
    rating: 4.6,
    reviews: 124,
    image: PHOTO_LAKE
  }, {
    id: 2,
    name: 'Lacul Mostiștea',
    location: 'Călărași, 58 km',
    rating: 4.4,
    reviews: 88,
    image: PHOTO_COMP
  }, {
    id: 3,
    name: 'Lacul Cernica',
    location: 'Ilfov, 18 km',
    rating: 4.2,
    reviews: 53,
    image: PHOTO_LAKE
  }, {
    id: 4,
    name: 'Balta Comana',
    location: 'Giurgiu, 28 km',
    rating: 4.7,
    reviews: 201,
    image: PHOTO_COMP
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      overflow: 'auto',
      background: '#fff',
      paddingBottom: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '56px 20px 12px',
      position: 'sticky',
      top: 0,
      background: '#fff',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "heading1",
    style: {
      fontSize: 24
    }
  }, "B\u0103l\u021Bi"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: C.gray1,
      borderRadius: 10,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icons.Search, {
    size: 18,
    color: C.gray5
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Caut\u0103 balta...",
    style: {
      flex: 1,
      border: 0,
      background: 'transparent',
      outline: 'none',
      ...TYPE.body
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.indigo5,
      borderRadius: 10,
      padding: 10,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icons.Filter, {
    color: "#fff"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 12,
      overflowX: 'auto',
      paddingBottom: 4
    }
  }, filters.map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    onClick: () => setFilter(f),
    style: {
      flex: '0 0 auto',
      padding: '6px 12px',
      borderRadius: 999,
      background: filter === f ? C.indigo5 : '#fff',
      border: filter === f ? `2px solid ${C.indigo5}` : `2px solid ${C.indigo5}`,
      color: filter === f ? '#fff' : C.indigo5,
      ...TYPE.helper2,
      cursor: 'pointer'
    }
  }, f)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, lakes.map(l => /*#__PURE__*/React.createElement(Card, {
    key: l.id,
    onClick: () => onOpen?.(l),
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: l.image,
    style: {
      width: '100%',
      height: 160,
      objectFit: 'cover'
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "heading2"
  }, l.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Icons.MapPin, {
    color: C.indigo5,
    size: 12
  }), /*#__PURE__*/React.createElement(Text, {
    preset: "helper2",
    color: C.indigo5
  }, l.location)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, [1, 2, 3, 4, 5].map(i => /*#__PURE__*/React.createElement(Icons.Star, {
    key: i,
    size: 14,
    filled: i <= Math.round(l.rating)
  })), /*#__PURE__*/React.createElement(Text, {
    preset: "helper2",
    color: C.gray10
  }, l.rating, " \xB7 ", l.reviews, " recenzii")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    color: "green"
  }, "Crap"), /*#__PURE__*/React.createElement(Badge, {
    color: "yellow"
  }, "R\u0103pitor"), /*#__PURE__*/React.createElement(Badge, {
    color: "indigo"
  }, "Sportiv")))))));
}
Object.assign(window, {
  ProfileGreetCard,
  SectionTitle,
  CompetitionCard,
  MiniLakeCard,
  LakeRequestBanner,
  HorizontalList,
  DashboardScreen,
  CompetitionDetailScreen,
  LakesListScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/AppScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/AuthScreens.jsx
try { (() => {
// Bluvi mobile screens — recreations of key flows.
// References: app/onboarding.tsx, app/sign-in.tsx, app/(app)/(tabs)/index.tsx, _layout.tsx
const {
  C,
  TYPE,
  Text,
  Button,
  Badge,
  Card,
  Icons,
  LiveDot
} = window;
const PHOTO_LAKE = '../../assets/images/lake.jpeg';
const PHOTO_COMP = '../../assets/images/competition-placeholder.jpg';
const PHOTO_BIG = '../../assets/images/big-fish.png';
const LOGO_HORIZ = '../../assets/logo/bluvi_transparent_blue_horizontal.png';
const LOGO_FISH = '../../assets/logo/fish-logo.svg';
const LOGO_BLUVI = '../../assets/logo/logo_bluvi.png';
const ICON_GOOGLE = '../../assets/icons/google.svg';
const ICON_FACEBOOK = '../../assets/icons/facebook.svg';
const ICON_FISH = '../../assets/icons/fish.svg';
const ICON_SCALE = '../../assets/icons/scale.svg';
const ICON_ROD = '../../assets/icons/fishing-rod.svg';

// ───── Tab Bar ─────
function TabBar({
  active,
  onChange
}) {
  const tabs = [{
    key: 'home',
    icon: Icons.Home,
    label: 'Acasă'
  }, {
    key: 'lakes',
    icon: Icons.Map,
    label: 'Bălți'
  }, {
    key: 'competitions',
    icon: Icons.Trophy,
    label: 'Competiții'
  }, {
    key: 'news',
    icon: Icons.News,
    label: 'Noutăți'
  }, {
    key: 'profile',
    icon: Icons.User,
    label: 'Profil'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#fff',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      boxShadow: '0 -2px 3.84px rgba(0,0,0,.18)',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '10px 6px 24px',
      zIndex: 10
    }
  }, tabs.map(t => {
    const I = t.icon;
    const isActive = active === t.key;
    return /*#__PURE__*/React.createElement("div", {
      key: t.key,
      onClick: () => onChange?.(t.key),
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        cursor: 'pointer',
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(I, {
      color: isActive ? C.indigo5 : C.gray5,
      size: 24
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        ...TYPE.helper2,
        fontSize: 10,
        color: isActive ? C.indigo5 : C.gray5
      }
    }, t.label));
  }));
}

// ───── Sign-In Screen ─────
function SignInScreen({
  onSignIn
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '40px 20px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      background: '#fff',
      height: '100%',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: LOGO_FISH,
    width: 120,
    height: 120,
    style: {
      margin: '30px 0'
    },
    alt: ""
  }), /*#__PURE__*/React.createElement(Text, {
    preset: "heading1",
    style: {
      fontSize: 24,
      textAlign: 'center'
    }
  }, "Autentificare"), /*#__PURE__*/React.createElement(Text, {
    preset: "body",
    style: {
      textAlign: 'center'
    }
  }, "Autentific\u0103-te pentru a continua \xEEn aplica\u021Bie"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      width: '100%',
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Button, {
    preset: "secondary",
    icon: /*#__PURE__*/React.createElement("img", {
      src: ICON_GOOGLE,
      width: 20,
      height: 20
    }),
    onClick: onSignIn,
    style: {
      color: C.gray5,
      width: '100%'
    }
  }, "Autentific\u0103-te cu Google"), /*#__PURE__*/React.createElement(Button, {
    icon: /*#__PURE__*/React.createElement("img", {
      src: ICON_FACEBOOK,
      width: 20,
      height: 20
    }),
    onClick: onSignIn,
    style: {
      background: '#1877F2',
      width: '100%'
    }
  }, "Autentific\u0103-te cu Facebook"), /*#__PURE__*/React.createElement(Button, {
    preset: "default",
    onClick: onSignIn,
    style: {
      background: '#000',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "#fff"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M16.4 1.7c0 1.1-.4 2.1-1.1 3-.8 1-2 1.7-3.1 1.6-.1-1.1.4-2.2 1.1-3 .8-.9 2-1.5 3.1-1.6zM20.4 17.3c-.5 1.2-.8 1.7-1.5 2.7-1 1.4-2.4 3.2-4.1 3.3-1.5 0-1.9-1-3.9-1-2 0-2.5 1-4 1-1.7 0-3-1.6-4-3-2.8-3.8-3.1-8.3-1.4-10.6 1.2-1.7 3.1-2.7 4.9-2.7 1.8 0 3 1 4.5 1 1.5 0 2.4-1 4.5-1 1.6 0 3.3.9 4.5 2.4-3.9 2.2-3.3 7.8.5 8.9z"
  })), "Autentific\u0103-te cu Apple")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: onSignIn,
    style: {
      ...TYPE.body,
      color: C.indigo5,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Continu\u0103 ca vizitator"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      padding: '20px 0'
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "body",
    style: {
      textAlign: 'center'
    }
  }, "Autentific\xE2ndu-te, e\u0219ti de acord cu ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.indigo5,
      fontWeight: 700
    }
  }, "Termenii \u0219i Condi\u021Biile"), " \u0219i cu ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.indigo5,
      fontWeight: 700
    }
  }, "Politica de Confiden\u021Bialitate")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...TYPE.helper2,
      color: C.indigo5
    }
  }, "v2.1.0"))));
}

// ───── Onboarding ─────
function OnboardingScreen({
  onFinish
}) {
  const slides = [{
    title: 'Bine ai (re)venit in Bluvi!',
    desc: 'Lucram zilnic sa aducem imbunatatiri pentru tine si pentru comunitatea de pescuit din Romania. Iti multumim ca ne esti alaturi!',
    img: PHOTO_LAKE
  }, {
    title: 'Descoperă locuri de pescuit în apropierea ta',
    desc: 'Explorează harta noastră interactivă pentru a găsi lacul perfect pentru următoarea ta captură',
    img: PHOTO_LAKE
  }, {
    title: 'Participă la competiții de pescuit',
    desc: 'Înscrie-te ca participant, urmărește programul competitiilor și concurează cu alți pescari',
    img: PHOTO_COMP
  }];
  const [i, setI] = React.useState(0);
  const isLast = i === slides.length - 1;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '20px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#fff',
      height: '100%',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: LOGO_HORIZ,
    style: {
      height: 30,
      margin: '5px 0 20px'
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      flex: 1,
      marginBottom: 36,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: slides[i].img,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: 16
    },
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: -20,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      gap: 6
    }
  }, slides.map((_, j) => /*#__PURE__*/React.createElement("span", {
    key: j,
    style: {
      width: 7,
      height: 7,
      borderRadius: 999,
      background: j === i ? C.indigo5 : C.gray2
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      height: 120,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement(Text, {
    preset: "heading1",
    style: {
      fontSize: 24,
      textAlign: 'center'
    }
  }, slides[i].title), /*#__PURE__*/React.createElement(Text, {
    preset: "body",
    style: {
      fontWeight: 400,
      textAlign: 'center',
      lineHeight: '22px',
      maxWidth: '90%',
      alignSelf: 'center'
    }
  }, slides[i].desc)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => isLast ? onFinish?.() : setI(i + 1),
    style: {
      width: '100%'
    }
  }, isLast ? 'Începe' : 'Următorul'), /*#__PURE__*/React.createElement(Button, {
    preset: "chromeless",
    onClick: onFinish,
    style: {
      width: '100%'
    }
  }, "Sari peste")));
}
Object.assign(window, {
  TabBar,
  SignInScreen,
  OnboardingScreen,
  PHOTO_LAKE,
  PHOTO_COMP,
  PHOTO_BIG,
  LOGO_HORIZ,
  LOGO_FISH,
  LOGO_BLUVI,
  ICON_FISH,
  ICON_SCALE,
  ICON_ROD
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/AuthScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/Primitives.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Bluvi UI primitives — exported to window for cross-script use.
// Source of truth: tribustech/bluvi-mobile-app
//   theme.ts, components/Typography.tsx, components/Button.tsx, components/Badge.tsx

const C = {
  indigo1: '#F0F3FD',
  indigo2: '#E0E7FF',
  indigo4: '#A5B4FC',
  indigo5: '#6366F1',
  indigo7: '#4338CA',
  cyan6: '#0891B2',
  green2: '#E5F6F3',
  green3: '#6BBAA3',
  green3_20: 'rgba(107,186,163,0.125)',
  green5: '#4CB944',
  green7: '#15803D',
  red1: '#FEE4E2',
  red5: '#F43F5E',
  red6: '#E11D48',
  yellow1_50: 'rgba(254,249,195,0.314)',
  yellow6: '#CA8A04',
  gray1: '#F2F2F2',
  gray2: '#E5E5E5',
  gray4: '#A3A3A3',
  gray5: '#737373',
  gray7: '#404040',
  gray10: '#262626',
  white: '#fff',
  black: '#000'
};
const FONT = '"Nunito", -apple-system, system-ui, sans-serif';
const TYPE = {
  heading1: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: 700,
    lineHeight: '32px'
  },
  heading2: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: 700,
    lineHeight: '24px'
  },
  heading3: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: '24px'
  },
  body: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: 600,
    lineHeight: '20px'
  },
  body2: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 600,
    lineHeight: '18px'
  },
  helper: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: '20px'
  },
  helper2: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: '15px'
  }
};
function Text({
  preset = 'body',
  color,
  style,
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      ...TYPE[preset],
      color: color || C.gray10,
      ...style
    }
  }, rest), children);
}
const PRESET_BG = {
  default: {
    bg: C.indigo5,
    fg: '#fff',
    shadow: '0 2px 4px rgba(10,10,10,.10)'
  },
  secondary: {
    bg: '#fff',
    fg: C.indigo5,
    shadow: '0 2px 4px rgba(10,10,10,.10)'
  },
  outlined: {
    bg: '#fff',
    fg: C.indigo5,
    border: `2px solid ${C.indigo5}`,
    shadow: 'none'
  },
  red: {
    bg: C.red5,
    fg: '#fff',
    shadow: '0 2px 4px rgba(10,10,10,.10)'
  },
  green: {
    bg: C.green5,
    fg: '#fff',
    shadow: '0 2px 4px rgba(10,10,10,.10)'
  },
  rose: {
    bg: C.red1,
    fg: C.red5,
    shadow: 'none'
  },
  chromeless: {
    bg: 'transparent',
    fg: C.indigo5,
    shadow: 'none'
  },
  follow: {
    bg: C.gray7,
    fg: '#fff',
    shadow: '0 2px 4px rgba(10,10,10,.10)'
  }
};
function Button({
  preset = 'default',
  children,
  onClick,
  disabled,
  icon,
  style
}) {
  const p = PRESET_BG[preset] || PRESET_BG.default;
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: disabled,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      background: p.bg,
      color: p.fg,
      border: p.border || '0',
      borderRadius: 10,
      padding: '10px 14px',
      cursor: disabled ? 'default' : 'pointer',
      boxShadow: p.shadow,
      opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      ...TYPE.body,
      fontWeight: 700,
      transition: 'opacity .12s',
      ...style
    }
  }, icon, children);
}
const BADGE_THEMES = {
  indigo: {
    bg: C.indigo1,
    fg: C.indigo5
  },
  solidIndigo: {
    bg: C.indigo5,
    fg: '#fff'
  },
  green: {
    bg: C.green3_20,
    fg: C.green3
  },
  yellow: {
    bg: C.yellow1_50,
    fg: C.yellow6
  },
  red: {
    bg: C.red1,
    fg: C.red5
  },
  gray: {
    bg: C.gray2,
    fg: C.gray10
  }
};
function Badge({
  color = 'indigo',
  icon,
  iconRight,
  children,
  style
}) {
  const t = BADGE_THEMES[color];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: t.bg,
      color: t.fg,
      borderRadius: 2,
      padding: '2.5px 4px',
      alignSelf: 'flex-start',
      ...TYPE.helper2,
      ...style
    }
  }, icon, children, iconRight);
}
function Card({
  children,
  style,
  onClick,
  glow
}) {
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    style: {
      background: '#fff',
      borderRadius: 10,
      boxShadow: glow ? '0 2px 10px rgba(99,102,241,.15)' : '0 5px 3.84px rgba(0,0,0,.25)',
      cursor: onClick ? 'pointer' : 'default',
      opacity: pressed ? 0.7 : 1,
      transition: 'opacity .12s',
      ...style
    }
  }, children);
}

// Heroicons inline (outline)
const Icons = {
  Home: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 24,
    height: p.size || 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 12l9-9 9 9M5 10v10h14V10"
  })),
  Map: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 24,
    height: p.size || 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 6l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2zM9 6v14M15 8v14"
  })),
  Trophy: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 24,
    height: p.size || 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 4h8v3a4 4 0 11-8 0V4zM6 7H3v2a3 3 0 003 3M18 7h3v2a3 3 0 01-3 3M9 14v2a3 3 0 003 3 3 3 0 003-3v-2M8 21h8"
  })),
  News: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 24,
    height: p.size || 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 4h12a2 2 0 012 2v14a2 2 0 002-2V8h-2M4 4v16h12M7 8h6M7 12h6M7 16h4"
  })),
  User: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 24,
    height: p.size || 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 21a8 8 0 0116 0"
  })),
  Bell: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 24,
    height: p.size || 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "1.8"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M15 17h5l-1.4-1.4A2 2 0 0118 14V11a6 6 0 10-12 0v3a2 2 0 01-.6 1.6L4 17h5m6 0a3 3 0 11-6 0"
  })),
  MapPin: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 16,
    height: p.size || 16,
    viewBox: "0 0 20 20",
    fill: p.color || 'currentColor'
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2a6 6 0 016 6c0 4.5-6 10-6 10S4 12.5 4 8a6 6 0 016-6zm0 8a2 2 0 100-4 2 2 0 000 4z"
  })),
  Check: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 14,
    height: p.size || 14,
    viewBox: "0 0 20 20",
    fill: p.color || 'currentColor'
  }, /*#__PURE__*/React.createElement("path", {
    d: "M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z"
  })),
  Search: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 20,
    height: p.size || 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.35-4.35"
  })),
  ChevronLeft: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 24,
    height: p.size || 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M15 6l-6 6 6 6"
  })),
  Filter: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 20,
    height: p.size || 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 6h18M6 12h12M10 18h4"
  })),
  Heart: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 20,
    height: p.size || 20,
    viewBox: "0 0 24 24",
    fill: p.filled ? p.color || 'currentColor' : 'none',
    stroke: p.color || 'currentColor',
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 21s-7-4.5-9.5-9C0.5 8 3 4 7 4c2 0 3.5 1 5 2.5C13.5 5 15 4 17 4c4 0 6.5 4 4.5 8-2.5 4.5-9.5 9-9.5 9z"
  })),
  Star: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 16,
    height: p.size || 16,
    viewBox: "0 0 24 24",
    fill: p.filled ? p.color || '#EAB308' : 'none',
    stroke: p.color || '#EAB308',
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2l3 7 7 .8-5.5 4.8 1.7 7.4L12 18l-6.2 4 1.7-7.4L2 9.8 9 9z"
  })),
  Calendar: p => /*#__PURE__*/React.createElement("svg", {
    width: p.size || 16,
    height: p.size || 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: p.color || 'currentColor',
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 9h18M8 3v4M16 3v4"
  }))
};
function LiveDot() {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: C.red6,
      color: '#fff',
      borderRadius: 2,
      padding: '2.5px 6px',
      ...TYPE.helper2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: '#fff',
      display: 'inline-block'
    }
  }), "LIVE");
}
Object.assign(window, {
  C,
  FONT,
  TYPE,
  Text,
  Button,
  Badge,
  Card,
  Icons,
  LiveDot
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/Primitives.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/ios-frame.jsx
try { (() => {
// iOS.jsx — Simplified iOS 26 (Liquid Glass) device frame
// Based on the iOS 26 UI Kit + Figma status bar spec. No assets, no deps.
// Exports: IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard

// ─────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────
function IOSStatusBar({
  dark = false,
  time = '9:41'
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 154,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '21px 24px 19px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 20,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: '-apple-system, "SF Pro", system-ui',
      fontWeight: 590,
      fontSize: 17,
      lineHeight: '22px',
      color: c
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingTop: 1,
      paddingRight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "12",
    viewBox: "0 0 19 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7.5",
    width: "3.2",
    height: "4.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.8",
    y: "5",
    width: "3.2",
    height: "7",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.6",
    y: "2.5",
    width: "3.2",
    height: "9.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14.4",
    y: "0",
    width: "3.2",
    height: "12",
    rx: "0.7",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "12",
    viewBox: "0 0 17 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z",
    fill: c
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "10.5",
    r: "1.5",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "13",
    viewBox: "0 0 27 13"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "23",
    height: "12",
    rx: "3.5",
    stroke: c,
    strokeOpacity: "0.35",
    fill: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "9",
    rx: "2",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z",
    fill: c,
    fillOpacity: "0.4"
  }))));
}

// ─────────────────────────────────────────────────────────────
// Liquid glass pill — blur + tint + shine
// ─────────────────────────────────────────────────────────────
function IOSGlassPill({
  children,
  dark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      minWidth: 44,
      borderRadius: 9999,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Navigation bar — glass pills + large title
// ─────────────────────────────────────────────────────────────
function IOSNavBar({
  title = 'Title',
  dark = false,
  trailingIcon = true
}) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pillIcon = content => /*#__PURE__*/React.createElement(IOSGlassPill, {
    dark: dark
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, content));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 62,
      paddingBottom: 10,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "20",
    viewBox: "0 0 12 20",
    fill: "none",
    style: {
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2L2 10l8 8",
    stroke: muted,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), trailingIcon && pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "6",
    viewBox: "0 0 22 6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "3",
    r: "2.5",
    fill: muted
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      fontFamily: '-apple-system, system-ui',
      fontSize: 34,
      fontWeight: 700,
      lineHeight: '41px',
      color: text,
      letterSpacing: 0.4
    }
  }, title));
}

// ─────────────────────────────────────────────────────────────
// Grouped list (inset card, r:26) + row (52px)
// ─────────────────────────────────────────────────────────────
function IOSListRow({
  title,
  detail,
  icon,
  chevron = true,
  isLast = false,
  dark = false
}) {
  const text = dark ? '#fff' : '#000';
  const sec = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const ter = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const sep = dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 52,
      padding: '0 16px',
      position: 'relative',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      letterSpacing: -0.43
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: icon,
      marginRight: 12,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: text
    }
  }, title), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      color: sec,
      marginRight: 6
    }
  }, detail), chevron && /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "14",
    viewBox: "0 0 8 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l6 6-6 6",
    stroke: ter,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: icon ? 58 : 16,
      height: 0.5,
      background: sep
    }
  }));
}
function IOSList({
  header,
  children,
  dark = false
}) {
  const hc = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const bg = dark ? '#1C1C1E' : '#fff';
  return /*#__PURE__*/React.createElement("div", null, header && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: '-apple-system, system-ui',
      fontSize: 13,
      color: hc,
      textTransform: 'uppercase',
      padding: '8px 36px 6px',
      letterSpacing: -0.08
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 26,
      margin: '0 16px',
      overflow: 'hidden'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Device frame
// ─────────────────────────────────────────────────────────────
function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      borderRadius: 48,
      overflow: 'hidden',
      position: 'relative',
      background: dark ? '#000' : '#F2F2F7',
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
      fontFamily: '-apple-system, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 11,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 126,
      height: 37,
      borderRadius: 24,
      background: '#000',
      zIndex: 50
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IOSStatusBar, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, title !== undefined && /*#__PURE__*/React.createElement(IOSNavBar, {
    title: title,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, children), keyboard && /*#__PURE__*/React.createElement(IOSKeyboard, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      height: 34,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingBottom: 8,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 139,
      height: 5,
      borderRadius: 100,
      background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// Keyboard — iOS 26 liquid glass
// ─────────────────────────────────────────────────────────────
function IOSKeyboard({
  dark = false
}) {
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959';
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333';
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';

  // special-key icons
  const icons = {
    shift: /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "17",
      viewBox: "0 0 19 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z",
      fill: glyph
    })),
    del: /*#__PURE__*/React.createElement("svg", {
      width: "23",
      height: "17",
      viewBox: "0 0 23 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z",
      fill: "none",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 5l7 7M17 5l-7 7",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    ret: /*#__PURE__*/React.createElement("svg", {
      width: "20",
      height: "14",
      viewBox: "0 0 20 14"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 1v6H4m0 0l4-4M4 7l4 4",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  const key = (content, {
    w,
    flex,
    ret,
    fs = 25,
    k
  } = {}) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      height: 42,
      borderRadius: 8.5,
      flex: flex ? 1 : undefined,
      width: w,
      minWidth: 0,
      background: ret ? '#08f' : keyBg,
      boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Compact", system-ui',
      fontSize: fs,
      fontWeight: 458,
      color: ret ? '#fff' : glyph
    }
  }, content);
  const row = (keys, pad = 0) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      justifyContent: 'center',
      padding: `0 ${pad}px`
    }
  }, keys.map(l => key(l, {
    flex: true,
    k: l
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 15,
      borderRadius: 27,
      overflow: 'hidden',
      padding: '11px 0 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: dark ? '0 -2px 20px rgba(0,0,0,0.09)' : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      padding: '8px 22px 13px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, ['"The"', 'the', 'to'].map((w, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 25,
      background: '#ccc',
      opacity: 0.3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      color: sugg,
      letterSpacing: -0.43,
      lineHeight: '22px'
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      padding: '0 6.5px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']), row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14.25,
      alignItems: 'center'
    }
  }, key(icons.shift, {
    w: 45,
    k: 'shift'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      flex: 1
    }
  }, ['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(l => key(l, {
    flex: true,
    k: l
  }))), key(icons.del, {
    w: 45,
    k: 'del'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, key('ABC', {
    w: 92.25,
    fs: 18,
    k: 'abc'
  }), key('', {
    flex: true,
    k: 'space'
  }), key(icons.ret, {
    w: 92.25,
    ret: true,
    k: 'ret'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      width: '100%',
      position: 'relative'
    }
  }));
}
Object.assign(window, {
  IOSDevice,
  IOSStatusBar,
  IOSNavBar,
  IOSGlassPill,
  IOSList,
  IOSListRow,
  IOSKeyboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/ios-frame.jsx", error: String((e && e.message) || e) }); }

})();
