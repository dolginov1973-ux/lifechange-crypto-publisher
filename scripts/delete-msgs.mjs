// One-off: delete the premature text-only SKR result posts (sent before the verified
// screenshot P&L was ready), so the verified version replaces them cleanly. Message ids
// captured from the broadcast run log. Safe: the publisher bot deletes its own messages
// (<48h old). Remove this script + workflow after the one run.
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error('FATAL: TELEGRAM_BOT_TOKEN not set'); process.exit(1); }

const targets = [
  ['@LifeChange_crypto', 76],
  ['@LifeChange_crypto_hi', 11],
  ['@LifeChange_crypto_pt', 10],
  ['@LifeChange_crypto_vi', 10],
  ['@LifeChange_crypto_es', 10],
  ['@LifeChange_crypto_tr', 10],
  ['@LifeChange_crypto_id', 8],
  ['-1003529113891', 7],
];

for (const [chat, mid] of targets) {
  const r = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, message_id: mid }),
  });
  const j = await r.json();
  console.log(chat, mid, j.ok ? 'deleted' : 'FAIL ' + (j.description || ''));
}
