// v2 channel Title + Description (Bio) — source of truth for the one-off apply-meta runner
// (src/apply-meta.js). v2 = Variant-B positioning (honest-verified high-leverage). All
// descriptions are ≤255 chars (Telegram setChatDescription limit); titles ≤128.
// Keys must match CHANNELS in config.js. Exchange terms kept in EN; disclaimers localized.

export const CHANNEL_META = {
  en: {
    title: 'Lifechange Crypto | Verified Futures Signals',
    description:
      'Bold high-leverage signals — SL on every entry, unique Signal ID. Every closed trade screenshot-proven: wins AND losses.\n' +
      'Not licensed/regulated. Not financial advice. High risk of loss.',
  },
  hi: {
    title: 'Lifechange Crypto | Verified Futures Signals',
    description:
      'हाई-leverage futures signals — हर entry से पहले SL। हर trade exchange screenshot से verified: जीत और हार, दोनों।\n' +
      'Licensed/regulated नहीं। Financial advice नहीं। नुकसान का बड़ा रिस्क है।',
  },
  pt: {
    title: 'Lifechange Crypto | Sinais Verificados de Futuros',
    description:
      'Sinais de alta alavancagem — SL em toda entrada, ID único por sinal. Todo trade encerrado com print da exchange: ganhos E perdas.\n' +
      'Não regulamentado. Não é consultoria financeira. Alto risco de perda.',
  },
  vi: {
    title: 'Lifechange Crypto | Tín Hiệu Futures Đã Xác Minh',
    description:
      'Tín hiệu futures đòn bẩy cao — SL trước mỗi lệnh, Signal ID riêng. Mọi lệnh đóng đều có ảnh chụp sàn: thắng VÀ thua.\n' +
      'Không được cấp phép/quản lý. Không phải tư vấn tài chính. Rủi ro mất vốn cao.',
  },
  es: {
    title: 'Lifechange Crypto | Señales Verificadas de Futuros',
    description:
      'Señales de alto leverage con SL en cada entrada e ID único. Cada trade cerrado tiene captura de pantalla: ganancias Y pérdidas, sin filtros.\n' +
      'Sin licencia regulatoria. No es asesoría financiera. Alto riesgo de pérdida.',
  },
  tr: {
    title: 'Lifechange Crypto | Doğrulanmış Futures Sinyalleri',
    description:
      'Yüksek kaldıraçlı sinyaller — her girişte SL, benzersiz Sinyal ID.\n' +
      'Kazanç da kayıp da: her kapalı işlem ekran görüntüsüyle kanıtlı.\n' +
      'Lisanslı/denetimli değil. Finansal tavsiye değil. Yüksek kayıp riski.',
  },
  id: {
    title: 'Lifechange Crypto | Sinyal Futures Terverifikasi',
    description:
      'Sinyal high-leverage berani — SL di tiap entry, Signal ID unik. Tiap trade closed dibuktikan screenshot: wins DAN losses.\n' +
      'Bukan licensed/regulated. Bukan nasihat keuangan. Risiko rugi tinggi.',
  },
};
