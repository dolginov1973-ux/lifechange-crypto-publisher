// Admin helper: delete specific channel messages by (chat_id, message_id). The publisher
// bot can delete its own messages (<48h old). Pass the list as the DELETE_LIST env var, a
// JSON array of [chat, message_id] pairs, e.g.:
//   DELETE_LIST='[["@LifeChange_crypto",78],["-1003529113891",7]]' node scripts/delete-msgs.mjs
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) { console.error('FATAL: TELEGRAM_BOT_TOKEN not set'); process.exit(1); }

let targets;
try {
  targets = JSON.parse(process.env.DELETE_LIST || '[]');
} catch (e) {
  console.error('FATAL: DELETE_LIST is not valid JSON:', e.message);
  process.exit(1);
}
if (!Array.isArray(targets) || targets.length === 0) {
  console.error('FATAL: DELETE_LIST empty — nothing to delete.');
  process.exit(1);
}

for (const [chat, mid] of targets) {
  const r = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, message_id: mid }),
  });
  const j = await r.json();
  console.log(chat, mid, j.ok ? 'deleted' : 'FAIL ' + (j.description || ''));
}
