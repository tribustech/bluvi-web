'use client';

import { createContext, useContext } from 'react';

/** The phone sheet's resting heights (fish LakesResultsWithMap: closed · 40% · below the chrome). */
export type T2SheetSnap = 'hidden' | 'half' | 'full';

/**
 * What the layout tells the map so programmatic moves frame content in the part of the map the
 * user can see: on a phone the toolbar floats over the top and the sheet / pin card over the
 * bottom (fish frameRegionInBand); from 768 nothing covers the map but its own controls.
 */
export type T2Frame = {
  /** ≥768: list column beside the map (no sheet, toolbar above). */
  split: boolean;
  /** Pixels hidden at the top / bottom of the map. */
  top: number;
  bottom: number;
};

export const T2FrameContext = createContext<T2Frame>({ split: false, top: 0, bottom: 0 });

export function useT2Frame(): T2Frame {
  return useContext(T2FrameContext);
}

/**
 * What the map tells the layout (T2Map → T2Layout): whether it can show at all. While it cannot
 * (no WebGL, tile host down) the page's status pills over it step aside for the map's own note.
 */
export type T2LayoutBridge = { setMapUnavailable: (unavailable: boolean) => void };

const NOOP_BRIDGE: T2LayoutBridge = { setMapUnavailable: () => {} };

export const T2LayoutBridgeContext = createContext<T2LayoutBridge>(NOOP_BRIDGE);

export function useT2LayoutBridge(): T2LayoutBridge {
  return useContext(T2LayoutBridgeContext);
}
