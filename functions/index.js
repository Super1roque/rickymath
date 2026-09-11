const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret } = require('firebase-functions/params')
const admin = require('firebase-admin')
const { Resend } = require('resend')

admin.initializeApp()

const DEEPGRAM_API_KEY = defineSecret('DEEPGRAM_API_KEY')
const RESEND_API_KEY = defineSecret('RESEND_API_KEY')

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

// Se dispara sola cada vez que se crea un usuario nuevo (usuarios/{uid})
// — mismo patrón que avisarNuevoTenant en Mi Ventita, misma cuenta de
// Resend. Manda dos correos independientes (uno no bloquea al otro si
// falla): un aviso para el dueño de RickyMath, y una bienvenida al
// usuario nuevo.
exports.avisarNuevoUsuario = onDocumentCreated(
  { document: 'usuarios/{uid}', secrets: [RESEND_API_KEY] },
  async event => {
    const usuario = event.data?.data()
    if (!usuario) return

    const resend = new Resend(RESEND_API_KEY.value())

    // Aviso interno — al dominio de pruebas de Resend, que solo puede
    // mandarle correo al dueño de la cuenta (vos), así que no hace falta
    // tener rickymath.com verificado en Resend para que esto funcione.
    const { data, error } = await resend.emails.send({
      from: 'RickyMath <onboarding@resend.dev>',
      to: 'super1roque@gmail.com',
      subject: `Nuevo usuario registrado en RickyMath: ${usuario.nombre || usuario.email}`,
      html: `
        <p>Se registró un usuario nuevo en RickyMath.</p>
        <ul>
          <li><strong>Nombre:</strong> ${usuario.nombre || '—'}</li>
          <li><strong>Email:</strong> ${usuario.email || '—'}</li>
          <li><strong>Teléfono:</strong> ${usuario.telefono || '—'}</li>
          <li><strong>Plan:</strong> ${usuario.plan || '—'}</li>
        </ul>
      `,
    })
    if (error) {
      console.error('Resend devolvió un error al avisar del nuevo usuario:', error)
    } else {
      console.log('Alerta de nuevo usuario enviada, id:', data?.id)
    }

    if (!usuario.email) return

    // Remitente en el dominio propio (rickymath.com) — necesita estar
    // verificado en Resend, si no este envío va a fallar (el aviso de
    // arriba no se ve afectado, son llamadas independientes).
    const bienvenida = await resend.emails.send({
      from: 'RickyMath <hola@rickymath.com>',
      to: usuario.email,
      subject: `¡Bienvenido a RickyMath${usuario.nombre ? `, ${usuario.nombre}` : ''}!`,
      html: `
        <p>Hola${usuario.nombre ? ` ${usuario.nombre}` : ''},</p>
        <p>Tu cuenta ya está lista en <strong>RickyMath</strong> — Primero grado y las Tablas de Multiplicar son gratis para siempre.</p>
        <p><strong>Primeros pasos:</strong></p>
        <ul>
          <li>Elegí el grado y empezá a practicar — Ricky te va a ir guiando con voz en cada ejercicio.</li>
          <li>Si le gusta, podés desbloquear Segundo a Quinto y Problemas con un solo pago, sin suscripciones.</li>
        </ul>
        <p>
          <a href="https://rickymath.com/grados" style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">
            Entrar a RickyMath →
          </a>
        </p>
        <p style="color:#6b7080;font-size:13px;">Cualquier duda, respondé este correo.</p>
      `,
    })
    if (bienvenida.error) {
      console.error('Resend devolvió un error al mandar la bienvenida al usuario:', bienvenida.error)
    } else {
      console.log('Correo de bienvenida enviado, id:', bienvenida.data?.id)
    }
  },
)

// Corre una vez al día: le manda un recordatorio a quien lleva 3-4 días
// registrado y sigue en plan gratis, ofreciéndole desbloquear todo por
// L.350. La ventana de un día (en vez de "3 días o más") evita mandarlo
// más de una vez por esta vía sola, pero igual se marca `recordatorioEnviado`
// como red de seguridad extra (ej. si la función falla un día y hay que
// reintentar, no vuelve a mandarlo a quien ya lo recibió).
exports.recordatorioDesbloqueo = onSchedule(
  { schedule: 'every day 09:00', timeZone: 'America/Tegucigalpa', region: 'us-central1', secrets: [RESEND_API_KEY] },
  async () => {
    const ahora = Date.now()
    const DIA_MS = 24 * 60 * 60 * 1000
    // "3+ días" en vez de una ventana estricta de 24h — así agarra tanto a
    // cuentas nuevas que van cumpliendo 3 días, como a cuentas que ya
    // existían de antes (5, 10, 30+ días) y todavía no recibieron el
    // recordatorio. El flag `recordatorioEnviado` es lo único que evita
    // reenviarlo, no la ventana de tiempo.
    const hasta = new Date(ahora - 3 * DIA_MS)

    const snap = await admin.firestore()
      .collection('usuarios')
      .where('plan', '==', 'free')
      .where('status', '==', 'active')
      .get()

    const candidatos = snap.docs.filter(doc => {
      const u = doc.data()
      if (u.recordatorioEnviado) return false
      const creadoEn = u.creadoEn?.toDate ? u.creadoEn.toDate() : null
      return creadoEn && creadoEn < hasta
    })

    if (candidatos.length === 0) {
      console.log('recordatorioDesbloqueo: nadie pendiente de recordatorio hoy')
      return
    }

    const resend = new Resend(RESEND_API_KEY.value())

    for (const doc of candidatos) {
      const u = doc.data()
      if (!u.email) continue

      const { data, error } = await resend.emails.send({
        from: 'RickyMath <hola@rickymath.com>',
        to: u.email,
        subject: `${u.nombre ? `${u.nombre}, ¿` : '¿'}Cómo le fue a tu hijo con RickyMath?`,
        html: `
          <p>Hola${u.nombre ? ` ${u.nombre}` : ''},</p>
          <p>Ya llevás unos días practicando en <strong>RickyMath</strong> con Primero grado y las Tablas de Multiplicar, gratis.</p>
          <p>Si a tu hijo le está gustando, podés desbloquear <strong>Segundo a Quinto grado y Problemas</strong> con un solo pago de <strong>L. 350</strong> — sin suscripciones, para siempre.</p>
          <p>
            <a href="https://rickymath.com/desbloquear" style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">
              Desbloquear todo →
            </a>
          </p>
          <p style="color:#6b7080;font-size:13px;">Si preferís seguir solo con lo gratis, ningún problema — este es el único recordatorio que te vamos a mandar.</p>
        `,
      })
      if (error) {
        console.error(`Resend devolvió un error al mandar el recordatorio a ${u.email}:`, error)
        continue
      }
      console.log(`Recordatorio enviado a ${u.email}, id:`, data?.id)
      await doc.ref.update({ recordatorioEnviado: true, recordatorioEnviadoEn: admin.firestore.FieldValue.serverTimestamp() })
    }
  },
)
