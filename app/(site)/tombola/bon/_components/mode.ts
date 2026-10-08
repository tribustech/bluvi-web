import type { ReceiptUploadMode } from '../../_shared/copy';

/**
 * fish upload-receipt.tsx:17 `mode=add|replace`, anything else = first. The web's query speaks
 * Romanian (routes.raffleReceipt): `mod=adauga` → add, `mod=inlocuieste` → replace, else first.
 */
export function receiptModeFromParam(mod: string | undefined): ReceiptUploadMode {
  return mod === 'inlocuieste' ? 'replace' : mod === 'adauga' ? 'add' : 'first';
}
