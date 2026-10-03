const { createJiti } = require('jiti')
const jiti = createJiti(__filename, { alias: { '~': '/workspace', '~~': '/workspace' } })
jiti.import('/workspace/scripts/reconcile.smoke.ts').catch((err) => { console.error(err); process.exit(1) })
