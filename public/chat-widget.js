// Standalone "Ask Hushwork" chat for pages other than the wizard. Same /api/chat backend.
(() => {
  const css = `.hwc-btn{position:fixed;right:20px;bottom:20px;z-index:30;box-shadow:0 6px 24px rgba(0,0,0,.18)}
.hwc{position:fixed;right:20px;bottom:20px;z-index:31;width:380px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:var(--card);border-radius:20px;box-shadow:0 12px 48px rgba(0,0,0,.22);display:none;flex-direction:column;overflow:hidden}
@media (max-width:600px){.hwc{right:16px;left:16px;width:auto}.hwc-btn{right:16px}}
.hwc.on{display:flex}
.hwc header{padding:14px 16px;border-bottom:1px solid var(--hair);display:flex;justify-content:space-between;align-items:center;font-weight:600}
.hwc .log{flex:1;overflow-y:auto;padding:14px 16px;font-size:15px}
.hwc .m{margin:0 0 10px;padding:10px 12px;border-radius:14px;max-width:88%;white-space:pre-wrap;line-height:1.45}
.hwc .m.me{background:var(--ink);color:var(--bg);margin-left:auto}
.hwc .m.ai{background:var(--bg)}
.hwc .opts{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 8px}
.hwc .opts button{font-size:13px;padding:6px 12px;background:var(--card);color:var(--ink);border:1px solid var(--line)}
.hwc form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--hair)}
.hwc form input{font-size:15px;padding:9px 12px;flex:1;min-width:0}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wrap = document.createElement('div');
  wrap.innerHTML = `<button class="hwc-btn" id="hwcOpen">Ask Hushwork</button>
<div class="hwc" id="hwc" role="dialog" aria-label="Ask Hushwork">
  <header><span>Ask Hushwork</span><button class="ghost small" id="hwcClose">Close</button></header>
  <div class="log" id="hwcLog"><div class="m ai">Questions about this storefront, the message, or how your data stays private? Ask me. Please don't type private numbers here.</div></div>
  <div class="opts" id="hwcOpts"><button data-say="Do the broker's claims about 2234 Mission match city records?">Check the listing</button><button data-say="What should I ask the landlord before signing?">What to ask the landlord</button><button data-say="What grants or loans could I get as a first-time founder?">Grants and loans</button></div>
  <form id="hwcForm"><input id="hwcIn" placeholder="Type your question" autocomplete="off"><button>Send</button></form>
</div>`;
  document.body.appendChild(wrap);
  const $ = (id) => document.getElementById(id);
  const CH = [];
  const add = (role, text) => { const d = document.createElement('div'); d.className = 'm ' + (role === 'user' ? 'me' : 'ai'); d.textContent = text; $('hwcLog').appendChild(d); $('hwcLog').scrollTop = 1e9; return d; };
  async function say(text) {
    if (!text.trim()) return;
    CH.push({ role: 'user', content: text }); add('user', text); $('hwcOpts').innerHTML = ''; $('hwcIn').value = '';
    const wait = add('ai', 'Checking city records and programs…');
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: CH, context: { storefront: '2234 Mission Street' } }) });
      const j = await r.json(); if (!r.ok || j.ok === false) throw new Error(j.error || r.statusText);
      wait.remove(); CH.push({ role: 'assistant', content: j.reply }); add('assistant', j.reply);
      $('hwcOpts').innerHTML = (j.options || []).map((o) => `<button data-say="${esc(o)}">${esc(o)}</button>`).join('');
    } catch (e) { wait.textContent = 'Sorry, the guide is unavailable: ' + e.message; CH.pop(); }
  }
  $('hwcOpen').onclick = () => { $('hwc').classList.add('on'); $('hwcOpen').style.display = 'none'; $('hwcIn').focus(); };
  $('hwcClose').onclick = () => { $('hwc').classList.remove('on'); $('hwcOpen').style.display = ''; };
  $('hwcForm').onsubmit = (e) => { e.preventDefault(); say($('hwcIn').value); };
  $('hwcOpts').addEventListener('click', (e) => { const b = e.target.closest('button[data-say]'); if (b) { e.stopPropagation(); say(b.dataset.say); } });
})();
