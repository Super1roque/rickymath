const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')

admin.initializeApp()

const DEEPGRAM_API_KEY = defineSecret('DEEPGRAM_API_KEY')

// Lee en voz alta un texto arbitrario con Deepgram Aura-2 (voz "olivia",
// español) — usado por los botones de audio/explicación de las guías
// interactivas. Se expone en /api/guia-voz vía rewrite (ver firebase.json)
// para que el fetch del cliente sea same-origin y no haga falta CORS.
exports.guiaVoz = onRequest(
  { region: 'us-central1', secrets: [DEEPGRAM_API_KEY], cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed')
      return
    }
    const texto = (req.body && req.body.texto ? String(req.body.texto) : '').trim()
    if (!texto || texto.length > 500) {
      res.status(400).send('Falta texto o es demasiado largo')
      return
    }

    try {
      const dgRes = await fetch(
        'https://api.deepgram.com/v1/speak?model=aura-2-olivia-es&encoding=mp3',
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${DEEPGRAM_API_KEY.value()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: texto }),
        },
      )
      if (!dgRes.ok) {
        const err = await dgRes.text()
        console.error('Deepgram TTS error:', dgRes.status, err)
        res.status(502).send('Error generando audio')
        return
      }
      const audioBuffer = Buffer.from(await dgRes.arrayBuffer())
      res.set('Content-Type', 'audio/mpeg')
      res.set('Cache-Control', 'public, max-age=86400')
      res.send(audioBuffer)
    } catch (e) {
      console.error('guiaVoz error:', e)
      res.status(500).send('Error interno')
    }
  },
)

// Crea el doc usuarios/{uid} para cuentas de Firebase Auth que se
// registraron antes de que existiera ese doc (o que por lo que sea nunca
// lo tuvieron) — el cliente ya autocompleta esto la próxima vez que ESA
// cuenta abre la app (ver AuthContext), pero para que el superadmin las
// vea en el panel sin esperar a que vuelvan a entrar, hace falta el
// Admin SDK para listar TODOS los usuarios de Auth, algo que el cliente
// no puede hacer. Solo lo puede llamar quien ya esté en superadmins/{uid}.
exports.backfillTenants = onCall({ region: 'us-central1' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Hay que iniciar sesión')
  const soyAdmin = await admin.firestore().doc(`superadmins/${request.auth.uid}`).get()
  if (!soyAdmin.exists) throw new HttpsError('permission-denied', 'No autorizado')

  let creados = 0
  let pageToken
  do {
    const pagina = await admin.auth().listUsers(1000, pageToken)
    for (const u of pagina.users) {
      const ref = admin.firestore().doc(`usuarios/${u.uid}`)
      const snap = await ref.get()
      if (snap.exists) continue
      await ref.set({
        nombre: u.displayName || '',
        email: u.email || '',
        telefono: u.phoneNumber || '',
        status: 'active',
        plan: 'free',
        creadoEn: admin.firestore.Timestamp.fromDate(new Date(u.metadata.creationTime)),
      })
      creados++
    }
    pageToken = pagina.pageToken
  } while (pageToken)

  return { creados }
})
