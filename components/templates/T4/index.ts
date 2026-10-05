/**
 * T4 «Multi-step form» (ROADMAP §4) — create competition, booking, registration, walk-in, review.
 *
 *   <T4Frame
 *     header={<T4Header back eyebrow title step total status={<T4SaveStatus/>} progress={<T4Progress/>} />}
 *     rail={<T4StepList/>}                 // ≥1280, left
 *     aside={<T4Summary/>}                 // ≥1280, right
 *     actions={<T4ActionBar primary back meta={<T4ActionTotal/>} />}>
 *     <T4ErrorSummary/> <T4Notice/> <T4Section>…fields / <T4ChoiceCard>…</T4Section>
 *   </T4Frame>
 *
 * Per-step validation: `validateStep(domainSchema.pick({...}), values, fields)`.
 * Demo with every state: /dev/templates/t4.
 */
export * from './types';
export * from './validation';
export * from './T4Frame';
export * from './T4Header';
export * from './T4Steps';
export * from './T4Section';
export * from './T4ChoiceCard';
export * from './T4ActionBar';
export * from './T4Status';
export * from './T4ErrorSummary';
export * from './T4Summary';
export * from './T4Skeleton';
export * from './T4Gate';
export * from './T4TextArea';
