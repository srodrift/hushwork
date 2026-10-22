import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHushwork } from '../src/core.js';
import { guideChat, redact } from '../src/guideChat.js';

test('redact hides money and ID numbers typed into chat', () => {
  const r = redact('I have $80,000 saved, revenue 120,000, SSN 900-12-3456');
  assert.doesNotMatch(r, /80,000|120,000|900-12-3456/);
});

test('chat uses tools, returns options, and the model never sees vault values', async () => {
  const hw = createHushwork();
  const seen = [];
  let n = 0;
  const client = { messages: { create: async (req) => {
    seen.push(JSON.stringify(req));
    n++;
    if (n === 1) return { content: [{ type: 'tool_use', id: 't1', name: 'check_funding', input: { food: true, seating: true, neighborhood: 'mission' } }] };
    return { content: [{ type: 'text', text: 'Kiva and La Cocina may fit.\nOPTIONS: Show links | Is the Mission a good fit? | What first?' }] };
  } } };
  const r = await guideChat({ hw, client, evidence: null, snapshot: null, sites: [], history: [{ role: 'user', content: 'coffee shop, I have $80,000' }] });
  assert.equal(r.reply, 'Kiva and La Cocina may fit.');
  assert.deepEqual(r.options, ['Show links', 'Is the Mission a good fit?', 'What first?']);
  assert.deepEqual(r.toolsUsed, ['check_funding']);
  assert.deepEqual(r.secretsInModelContext, []);
  for (const v of hw._vaultValuesForTests()) assert.ok(!seen.join('').includes(v), v);
  assert.ok(!seen.join('').includes('80,000'));
});
