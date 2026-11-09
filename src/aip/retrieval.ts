// Retrieval — BM25-style, dependency-free, works in Tauri and browser.
// Token overlap + phrase bonus, length-normalized. Upgrade path: rusqlite FTS5 in Rust.
import { CORPUS, type CorpusChunk } from './corpus'

const STOP = new Set(['the','a','an','is','are','was','were','of','for','to','in','on','at','by','with','and','or','it','its','this','that','be','as','from','what','which','how','does','do','can','will','would','should','about','into','your','you','me','my','we','i'])

export const tokenize = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\-€$% ]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t))

/** Domain-synonym expansion so "TB" matches "tuberculosis" across docs and queries. */
const expand = (s: string) => s.replace(/\btb\b/gi, 'tuberculosis')

export type ScoredChunk = CorpusChunk & { score: number }
export type RetrievalResult =
  | { grounded: true; hits: ScoredChunk[]; best: number }
  | { grounded: false; hits: ScoredChunk[]; best: number; threshold: number }

const K1 = 1.6, B = 0.75
const docTokens = CORPUS.map(c => tokenize(expand(`${c.title} ${c.body} ${c.source}`)))
const docLens = docTokens.map(t => t.length)
const AVG_LEN = docLens.reduce((a, b) => a + b, 0) / docLens.length
const DF = new Map<string, number>()
for (const toks of docTokens) for (const t of new Set(toks)) DF.set(t, (DF.get(t) ?? 0) + 1)
const IDF = (t: string) => Math.log(1 + (CORPUS.length - (DF.get(t) ?? 0) + 0.5) / ((DF.get(t) ?? 0) + 0.5))

/** BM25-ish score with phrase bonus. Returns top-k and a grounded verdict. */
export function retrieve(query: string, k = 6, threshold = 3.2): RetrievalResult {
  const qToks = tokenize(expand(query))
  const qPhrase = expand(query).toLowerCase().trim()
  const scored = CORPUS.map((chunk, i) => {
    const toks = docTokens[i]
    const tf = new Map<string, number>()
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
    let score = 0
    for (const q of qToks) {
      const f = tf.get(q) ?? 0
      if (!f) continue
      score += IDF(q) * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (docLens[i] / AVG_LEN))))
    }
    // phrase bonus: a ≥3-word window from the query appearing verbatim in the doc
    const words = qPhrase.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w))
    for (let n = Math.min(5, words.length); n >= 3; n--) {
      for (let i0 = 0; i0 + n <= words.length; i0++) {
        if (`${chunk.title} ${chunk.body}`.toLowerCase().includes(words.slice(i0, i0 + n).join(' '))) score += 1.5
      }
    }
    return { ...chunk, score: Math.round(score * 1000) / 1000 }
  })

  scored.sort((a, b) => b.score - a.score)
  const hits = scored.filter(s => s.score > 0).slice(0, k)
  const best = hits[0]?.score ?? 0
  return best >= threshold ? { grounded: true, hits, best } : { grounded: false, hits: hits.slice(0, 2), best, threshold }
}

/** Inject hits into a system prompt with numbered markers. */
export function buildGroundedPrompt(base: string, hits: ScoredChunk[]): string {
  const body = hits.map((h, i) => `[${i + 1}] ${h.title} (${h.source})\n${h.body}`).join('\n\n')
  return `${base}\n\nGROUNDING — answer ONLY from these sources. Cite inline as [n]. If the sources do not answer the question, say so plainly instead of guessing.\n\n${body}`
}
