// One-off CLOUD probe: tests the Bitunix PARTNER dashboard backend endpoint
//   GET /partner/user/info/{uid}   (auth header: `token`)
// from a server (GitHub Actions) to answer the two open questions:
//   (1) does Cloudflare / Aliyun WAF block server-side calls (vs a browser)?
//   (2) does the token work + are the referral-verification fields present?
// Reads BITUNIX_PARTNER_TOKEN (secret) + optional TEST_UID. NEVER prints the token.
//
//   node src/bitunix-probe.js     (env: BITUNIX_PARTNER_TOKEN, TEST_UID?)
//
// This is throwaway diagnostics that lives in the publisher repo only because that's our
// ready cloud-exec env. The production verifier moves into the VIP bot's own (private) env.

const TOKEN = process.env.BITUNIX_PARTNER_TOKEN;
const UID = process.env.TEST_UID || '525949154';
const OUR_CODE = process.env.OUR_REF_CODE || 'EJGI';
const OUR_PARTNER_UID = Number(process.env.OUR_PARTNER_UID || '925331171');
const MIN_BALANCE = Number(process.env.MIN_BALANCE_USDT || '50');

if (!TOKEN) {
  console.error('BITUNIX_PARTNER_TOKEN missing — set it as a secret.');
  process.exit(1);
}

const url = `https://partners.bitunix.com/partner/user/info/${UID}?_t=${Date.now()}`;

const res = await fetch(url, {
  method: 'GET',
  headers: {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-US',
    referer: 'https://partners.bitunix.com/',
    token: TOKEN,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
  },
});

const ct = res.headers.get('content-type') || '';
const cfRay = res.headers.get('cf-ray') || '-';
console.log(`HTTP ${res.status} · content-type: ${ct} · cf-ray: ${cfRay}\n`);

const text = await res.text();
let body = null;
try {
  body = JSON.parse(text);
} catch {
  /* not JSON */
}

if (!body) {
  const snippet = text.slice(0, 400).replace(/\s+/g, ' ');
  console.log('❌ NON-JSON response — likely a Cloudflare/WAF challenge page. First 400 chars:');
  console.log(snippet);
  console.log(
    '\n⇒ WAF blocks datacenter (Actions) IPs. Options: residential/proxy egress, headless-browser refresh, or run the verifier from an egress the WAF tolerates. Token validity inconclusive until WAF is passed.',
  );
  process.exit(0);
}

console.log(`API code: ${body.code} · msg: ${body.msg}`);
const r = body.result;
if (!r) {
  console.log(
    'Got JSON but no result. Likely an auth/expiry error (token dead) or an error envelope. Body keys:',
    Object.keys(body),
  );
  process.exit(0);
}

const invitationCode = r.invitationCode;
const parentUid = r.parentUid;
const firstDepositTime = r.firstDepositTime;
const firstTradeTime = r.firstTradeTime;
const allAmount = parseFloat(r.allAmount || '0');

const isOurs = invitationCode === OUR_CODE || parentUid === OUR_PARTNER_UID;
const hasDeposited = firstDepositTime != null;
const meetsThreshold = allAmount >= MIN_BALANCE;
const hasTraded = firstTradeTime != null;
const verified = isOurs && hasDeposited && meetsThreshold;

console.log('\n--- verification fields ---');
console.log(`uid:              ${r.uid}`);
console.log(`invitationCode:   ${invitationCode}   (ours="${OUR_CODE}" → ${invitationCode === OUR_CODE})`);
console.log(`parentUid:        ${parentUid}   (ours=${OUR_PARTNER_UID} → ${parentUid === OUR_PARTNER_UID})`);
console.log(`firstDepositTime: ${firstDepositTime}   → hasDeposited=${hasDeposited}`);
console.log(`firstTradeTime:   ${firstTradeTime}   → hasTraded=${hasTraded}`);
console.log(`allAmount:        ${allAmount} USDT   (min=${MIN_BALANCE} → ${meetsThreshold})`);
console.log(`\nVERDICT for UID ${UID}: verified=${verified}`);
console.log('\n✅ Server-side call WORKS — WAF passed + token valid. Auto-verify is viable.');
