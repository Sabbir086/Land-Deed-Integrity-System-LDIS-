// Provisional name matching. Threshold and rule are NOT legally final (see docs/PROJECT_SPEC.md §Open decisions).
// A match here NEVER proves legal ownership; it only decides whether a record pair needs human review.
export const MATCH_THRESHOLD = 0.9;

export function normalizeName(s) {
  return String(s ?? "")
    .normalize("NFC")
    .replace(/[\u200c\u200d]/g, "") // zero-width joiners vary between data sources
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const x = Array.from(a), y = Array.from(b);
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[y.length];
}

// 1 = identical, 0 = nothing in common. Returns null when either side is empty (cannot compare).
export function similarity(a, b) {
  const x = normalizeName(a), y = normalizeName(b);
  if (!x || !y) return null;
  const longest = Math.max(Array.from(x).length, Array.from(y).length);
  return 1 - levenshtein(x, y) / longest;
}

export function compareField(a, b) {
  const score = similarity(a, b);
  return { a: a ?? null, b: b ?? null, score, exact: score === 1 };
}

// Does an attestation certificate bridge exactly these two spellings?
function attestationBridges(att, x, y) {
  const va = att.name_variant_a, vb = att.name_variant_b;
  const hit = (p, q) => (similarity(p, x) ?? 0) >= 0.99 && (similarity(q, y) ?? 0) >= 0.99;
  return hit(va, vb) || hit(vb, va);
}

// owner = porcha record, person = NID record. Rule: BOTH name and father name must reach the threshold.
export function compareOwnerToPerson({ owner, person, attestations = [] }) {
  const name = compareField(owner?.name, person?.name);
  const father = compareField(owner?.father_name, person?.father_name);
  const scores = [name.score, father.score];
  let outcome;
  if (scores.some((s) => s === null)) outcome = "insufficient_data";
  else if (Math.min(...scores) >= MATCH_THRESHOLD) outcome = "meets_provisional_threshold";
  else outcome = "discrepancy_review";

  const bridging = attestations.filter(
    (a) => (!name.exact && attestationBridges(a, owner?.name, person?.name)) ||
           (!father.exact && attestationBridges(a, owner?.father_name, person?.father_name))
  );
  return { threshold: MATCH_THRESHOLD, name, father, outcome, attestations, bridgingAttestations: bridging };
}
