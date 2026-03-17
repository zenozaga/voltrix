/**
 * 🧊 Core Metadata Symbols (Minimized)
 * Most metadata is now stored in consolidated MetadataBags.
 */

export const SYMBOLS = {
  // We keep these for internal tagging or legacy plugins that might query them
  METADATA: Symbol('voltrix:metadata'),
  LIFECYCLE: Symbol('voltrix:lifecycle'),
} as const;

export const LEGACY = {} as const;
