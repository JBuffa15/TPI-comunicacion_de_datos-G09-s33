import { useState, useRef } from 'react'
import styles from './ImageDigitizer.module.css'

const API = 'http://localhost:8000'

const RESOLUCIONES = [
  { label: '100 × 100', value: 100 },
  { label: '250 × 250', value: 250 },
  { label: '500 × 500', value: 500 },
  { label: '1000 × 1000', value: 1000 },
]

const BITS = [
  { label: '1 bit (blanco y negro)', value: 1 },
  { label: '2 bits (4 colores)', value: 2 },
  { label: '4 bits (16 colores)', value: 4 },
  { label: '8 bits (256 colores)', value: 8 },
  { label: '24 bits (color completo)', value: 24 },
]

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/bmp', 'image/webp' , 'image/jpg']
const MAX_SIZE_MB = 10

export default function ImageDigitizer() {
  const [file, setFile]           = useState(null)
  const [preview, setPreview]     = useState(null)
  const [resolucion, setResolucion] = useState(500)
  const [bits, setBits]           = useState(8)
  const [calidad, setCalidad]     = useState(80)
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const inputRef = useRef()

  // ── Validación en el frontend antes de enviar ──────────────────────────────
  const validarArchivo = (f) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return `Tipo de archivo no permitido (${f.type}). Usá PNG, JPG, BMP o WEBP.`
    }
    const sizeMB = f.size / (1024 * 1024)
    if (sizeMB > MAX_SIZE_MB) {
      return `El archivo pesa ${sizeMB.toFixed(1)} MB. El máximo es ${MAX_SIZE_MB} MB.`
    }
    return null
  }

  const handleFile = (f) => {
    if (!f) return
    const err = validarArchivo(f)
    if (err) { setError(err); return }
    setFile(f)
    setResultado(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.onerror = () => setError('No se pudo leer el archivo.')
    reader.readAsDataURL(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const procesar = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('resolucion', resolucion)
      form.append('bits', bits)
      form.append('calidad_jpeg', calidad)

      const res = await fetch(`${API}/procesar`, { method: 'POST', body: form })

      // Manejo de errores HTTP con mensaje del servidor
      if (!res.ok) {
        let msg = `Error ${res.status}`
        try {
          const err = await res.json()
          msg = err.detail || msg
        } catch (_) {}
        throw new Error(msg)
      }

      const data = await res.json()
      setResultado(data)
    } catch (e) {
      if (e.message === 'Failed to fetch') {
        setError('No se pudo conectar con el backend. ¿Está corriendo en localhost:8000?')
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const descargar = () => {
    if (!resultado) return
    const link = document.createElement('a')
    link.href = `data:image/jpeg;base64,${resultado.procesada.base64}`
    link.download = 'imagen_digitalizada.jpg'
    link.click()
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>◈</span>
            <div>
              <div className={styles.logoTitle}>Digitalización de Imágenes</div>
              <div className={styles.logoSub}>UTN FRLP · Comunicación de Datos 2025</div>
            </div>
          </div>
          <div className={styles.headerGroup}>
            <span className={styles.badge}>Propuesta 3</span>
            <span className={styles.badge2}>React + FastAPI</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.layout}>
          {/* Sidebar controles */}
          <aside className={styles.sidebar}>
            <section className={styles.card}>
              <div className={styles.cardTitle}>📁 Cargar imagen</div>
              <div
                className={styles.dropzone}
                onClick={() => inputRef.current.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {preview
                  ? <img src={preview} alt="preview" className={styles.dropPreview} />
                  : <>
                      <div className={styles.dropIcon}>⬆</div>
                      <div className={styles.dropText}>Arrastrá o hacé click</div>
                      <div className={styles.dropSub}>PNG, JPG, BMP, WEBP · máx. 10 MB</div>
                    </>
                }
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,.jpg,.jpeg,image/bmp,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
              {file && <div className={styles.fileName}>✓ {file.name} ({(file.size/1024/1024).toFixed(2)} MB)</div>}
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitle}>🔬 Parámetros</div>

              <div className={styles.control}>
                <label className={styles.label}>Muestreo (resolución)</label>
                <select value={resolucion} onChange={(e) => setResolucion(Number(e.target.value))}>
                  {RESOLUCIONES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <div className={styles.hint}>
                  Teorema de Nyquist: fs ≥ 2·fmax para evitar aliasing
                </div>
              </div>

              <div className={styles.control}>
                <label className={styles.label}>Cuantización (bits/canal)</label>
                <select value={bits} onChange={(e) => setBits(Number(e.target.value))}>
                  {BITS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                <div className={styles.hint}>
                  Niveles de color: 2<sup>{bits}</sup> = {Math.pow(2, bits).toLocaleString()}
                </div>
              </div>

              <div className={styles.control}>
                <label className={styles.label}>
                  Compresión JPEG &nbsp;
                  <span className={styles.rangeVal}>{calidad}%</span>
                </label>
                <input
                  type="range"
                  min="1" max="100"
                  value={calidad}
                  onChange={(e) => setCalidad(Number(e.target.value))}
                />
                <div className={styles.rangeRow}>
                  <span className={styles.hint}>Menor calidad → menor tamaño</span>
                </div>
              </div>
            </section>

            <button
              className={styles.btnPrimary}
              onClick={procesar}
              disabled={!file || loading}
            >
              {loading ? 'Procesando...' : '▶ Digitalizar imagen'}
            </button>

            {resultado && (
              <button className={styles.btnSecondary} onClick={descargar}>
                ⬇ Descargar resultado
              </button>
            )}

            {error && <div className={styles.error}>⚠ {error}</div>}
          </aside>

          {/* Área principal */}
          <section className={styles.content}>
            {!resultado && !loading && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>◈</div>
                <div className={styles.emptyTitle}>Cargá una imagen y configurá los parámetros</div>
                <div className={styles.emptySub}>
                  El resultado mostrará la comparación original vs. digitalizada con métricas de calidad
                </div>
              </div>
            )}

            {loading && (
              <div className={styles.empty}>
                <div className={styles.spinner}></div>
                <div className={styles.emptyTitle}>Procesando en el servidor...</div>
              </div>
            )}

            {resultado && (
              <>
                {/* Métricas */}
                <div className={styles.metricsRow}>
                  <MetricCard
                    label="Reducción de tamaño"
                    value={`${resultado.metricas.reduccion_pct}%`}
                    sub={`${resultado.original.size_kb} KB → ${resultado.procesada.size_kb} KB`}
                    color="success"
                  />
                  <MetricCard
                    label="PSNR"
                    value={`${resultado.metricas.psnr_db} dB`}
                    sub="Peak Signal-to-Noise Ratio"
                    color={resultado.metricas.psnr_db > 30 ? 'success' : 'warning'}
                  />
                  <MetricCard
                    label="Resolución salida"
                    value={`${resultado.procesada.width}×${resultado.procesada.height}`}
                    sub={`${resultado.procesada.bits} bits/canal`}
                    color="accent"
                  />
                  <MetricCard
                    label="Niveles de color"
                    value={Math.pow(2, resultado.procesada.bits).toLocaleString()}
                    sub={`2^${resultado.procesada.bits} por canal`}
                    color="accent"
                  />
                </div>

                {/* Comparación */}
                <div className={styles.compareGrid}>
                  <ImagePanel
                    title="🖼 Original"
                    src={`data:image/png;base64,${resultado.original.base64}`}
                    meta={[
                      `${resultado.original.width} × ${resultado.original.height} px`,
                      `24 bits/canal`,
                      `${resultado.original.size_kb} KB`,
                    ]}
                  />
                  <ImagePanel
                    title="⚙ Digitalizada"
                    src={`data:image/jpeg;base64,${resultado.procesada.base64}`}
                    meta={[
                      `${resultado.procesada.width} × ${resultado.procesada.height} px`,
                      `${resultado.procesada.bits} bits/canal`,
                      `${resultado.procesada.size_kb} KB`,
                    ]}
                    highlight
                  />
                </div>

                {/* Info teórica */}
                <div className={styles.theoryBox}>
                  <strong>Conceptos aplicados:</strong> Muestreo espacial ({resolucion}×{resolucion} px) →
                  Cuantización ({bits} bits → {Math.pow(2, bits)} niveles por canal) →
                  Compresión con pérdida JPEG (calidad {calidad}%) →
                  PSNR = {resultado.metricas.psnr_db} dB
                  {resultado.metricas.psnr_db < 25 && ' ⚠ calidad degradada por cuantización agresiva'}
                  {resultado.metricas.psnr_db >= 35 && ' ✓ buena fidelidad de reconstrucción'}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  const colors = { success: '#4caf82', warning: '#f0a84e', accent: '#5b8cff' }
  return (
    <div style={{
      background: '#1a1d27', border: '1px solid #2e3150',
      borderRadius: 10, padding: '14px 16px', flex: 1,
    }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: colors[color] }}>{value}</div>
      <div style={{ fontSize: 12, color: '#e8eaf0', marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#6b7090', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function ImagePanel({ title, src, meta, highlight }) {
  return (
    <div style={{
      background: '#1a1d27',
      border: `1px solid ${highlight ? '#5b8cff55' : '#2e3150'}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #2e3150',
        fontSize: 13, fontWeight: 500,
        color: highlight ? '#5b8cff' : '#9095b0',
      }}>{title}</div>
      <div style={{ padding: 10 }}>
        <img src={src} alt={title} style={{
          width: '100%', borderRadius: 6,
          imageRendering: 'pixelated', display: 'block',
        }} />
      </div>
      <div style={{ padding: '8px 14px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {meta.map((m, i) => (
          <span key={i} style={{
            fontSize: 11, background: '#23263a', color: '#9095b0',
            padding: '2px 8px', borderRadius: 99,
          }}>{m}</span>
        ))}
      </div>
    </div>
  )
}
