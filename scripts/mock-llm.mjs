// Deterministic mock OpenAI-compatible endpoint for verifying the agent loop.
// Turn 1 (no tool_result yet): emit a tool call. Turn 2: emit the grounded answer.
import http from 'node:http'

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (req.method !== 'POST' || !req.url.endsWith('/chat/completions')) { res.writeHead(404); return res.end('{}') }

  let body = ''
  req.on('data', c => (body += c))
  req.on('end', () => {
    const parsed = JSON.parse(body || '{}')
    const msgs = parsed.messages ?? []
    const flat = msgs.map(m => m.content).join('\n')
    const isGrounded = flat.includes('GROUNDING — answer ONLY from these sources')
    const hasResult = msgs.some(m => m.role === 'user' && m.content.trimStart().startsWith('<tool_result>'))

    let content
    if (isGrounded || hasResult) {
      content = [
        'Pulmonary TB is treated with a 2-month intensive phase of isoniazid, rifampin, pyrazinamide and ethambutol (HRZE), then a 4-month continuation phase of isoniazid plus rifampin (HR). [1][2] Pyridoxine should be supplemented to prevent isoniazid neuropathy. [2]\n\n',
        'Action: drafted grounded TB answer · Evidence: chunk-tb-1, chunk-tb-2 · Verification: 2 citations from corpus · Next step: publish as a logic function if clinical review signs off.',
      ].join('')
    } else {
      content = '<tool>{"name":"ontology.list","args":{}}</tool>'
    }

    if (parsed.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      const chunks = content.match(/.{1,48}/gs) ?? [content]
      for (const c of chunks) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`)
      }
      res.write(`data: ${JSON.stringify({ choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 300, completion_tokens: 120, total_tokens: 420 } })}\n\n`)
      res.write('data: [DONE]\n\n')
      return res.end()
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      id: 'mock-1',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 300, completion_tokens: 120, total_tokens: 420 },
    }))
  })
})
server.listen(8399, () => console.log('mock LLM on :8399'))
