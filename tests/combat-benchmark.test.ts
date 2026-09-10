import { it, expect } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { runBenchmark } from '../scripts/combat-benchmark';

it('records labelled controlled-policy diagnostics across variants and encounter fixtures', async () => {
  const rows = runBenchmark();
  await mkdir('evidence/local', { recursive: true });
  await writeFile('evidence/local/combat-benchmark.json', JSON.stringify({ generatedAt: new Date().toISOString(), note: 'Deterministic policies and arranged fixtures; not human enjoyment evidence. Seeded hand seeds 17,123,91026; upgraded guardian in all comparisons.', rows }, null, 2));
  const opening = rows.filter(r => r.fixture === 'opening' && r.seed === 17);
  console.table(opening.map(({ variant, mode, traditions, policy, outcome, rounds, hp }) => ({ variant, mode, traditions, policy, outcome, rounds, hp })));
  expect(rows).toHaveLength(330);
  for (const tradition of ['margin', 'hearth']) expect(rows.some(r => r.variant === 'book' && r.mode === 'solo' && r.traditions === tradition && r.fixture === 'opening' && r.policy === 'adaptive' && r.outcome === 'victory')).toBe(true);
}, 30_000);
