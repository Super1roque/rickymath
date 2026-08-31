const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')

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
