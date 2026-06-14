from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
import numpy as np
import io
import base64

# ── Límites de validación ──────────────────────────────────────────────────────
MAX_FILE_SIZE_MB = 10
ALLOWED_TYPES    = {"image/jpeg", "image/png", "image/bmp", "image/webp"}
VALID_RESOLUTIONS = {100, 250, 500, 1000}
VALID_BITS        = {1, 2, 4, 8, 24}

app = FastAPI(title="Digitalización de Imágenes - API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Utilidades ─────────────────────────────────────────────────────────────────

def image_to_base64(img: Image.Image, fmt="PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def apply_sampling(img: Image.Image, resolution: int) -> Image.Image:
    """Muestreo: reducir resolución espacial y escalar de vuelta al original."""
    orig_w, orig_h = img.size
    small = img.resize((resolution, resolution), Image.NEAREST)
    return small.resize((orig_w, orig_h), Image.NEAREST)

def apply_quantization(img: Image.Image, bits: int) -> Image.Image:
    """Cuantización: reducir profundidad de bits por canal."""
    arr = np.array(img.convert("RGB"), dtype=np.float32)
    levels = 2 ** bits
    arr = np.floor(arr / 256 * levels) * (256 / levels)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def apply_compression(img: Image.Image, quality: int) -> tuple[Image.Image, int]:
    """Compresión JPEG con calidad variable. Retorna imagen y tamaño en bytes."""
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=quality)
    size = buf.tell()
    buf.seek(0)
    return Image.open(buf).copy(), size

def compute_psnr(orig: Image.Image, proc: Image.Image) -> float:
    """Peak Signal-to-Noise Ratio entre imagen original y procesada."""
    a = np.array(orig.convert("RGB"), dtype=np.float32)
    b = np.array(proc.convert("RGB").resize(orig.size), dtype=np.float32)
    mse = np.mean((a - b) ** 2)
    if mse == 0:
        return 100.0
    return round(20 * np.log10(255.0 / np.sqrt(mse)), 2)

def get_file_size_kb(img: Image.Image, fmt="PNG") -> float:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format=fmt)
    return round(buf.tell() / 1024, 1)

# ── Endpoint principal ─────────────────────────────────────────────────────────

@app.post("/procesar")
async def procesar_imagen(
    file: UploadFile = File(...),
    resolucion: int = Form(500),
    bits: int = Form(8),
    calidad_jpeg: int = Form(80),
):
    # 1. Validar tipo de archivo
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de archivo no soportado: '{file.content_type}'. "
                   f"Usá PNG, JPG, BMP o WEBP."
        )

    # 2. Leer y validar tamaño
    data = await file.read()
    size_mb = len(data) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"El archivo pesa {size_mb:.1f} MB. El máximo permitido es {MAX_FILE_SIZE_MB} MB."
        )

    # 3. Validar parámetros
    if resolucion not in VALID_RESOLUTIONS:
        raise HTTPException(status_code=422, detail=f"Resolución inválida. Valores válidos: {sorted(VALID_RESOLUTIONS)}")
    if bits not in VALID_BITS:
        raise HTTPException(status_code=422, detail=f"Bits inválidos. Valores válidos: {sorted(VALID_BITS)}")
    if not (1 <= calidad_jpeg <= 100):
        raise HTTPException(status_code=422, detail="La calidad JPEG debe estar entre 1 y 100.")

    # 4. Intentar abrir la imagen (detecta archivos corruptos)
    try:
        img_lazy = Image.open(io.BytesIO(data))
        img_lazy.verify()  # verifica integridad
        
        # Reabrir tras verify
        original = Image.open(io.BytesIO(data))
        
        # OPTIMIZACIÓN: Achicar la imagen ANTES de convertir a RGB para no explotar la memoria
        original.thumbnail((1200, 1200))
        
        # Ahora que es chiquita, la pasamos a RGB
        original = original.convert("RGB")
        
    except UnidentifiedImageError:
        raise HTTPException(status_code=422, detail="El archivo no es una imagen válida o está corrupto.")
    except Exception:
        raise HTTPException(status_code=422, detail="No se pudo procesar el archivo. Verificá que sea una imagen válida.")

    # 5. Pipeline de digitalización
    try:
        orig_w, orig_h = original.size
        orig_size_kb = get_file_size_kb(original)

        sampled    = apply_sampling(original, resolucion)
        quantized  = apply_quantization(sampled, bits)
        compressed, comp_bytes = apply_compression(quantized, calidad_jpeg)
        comp_size_kb = round(comp_bytes / 1024, 1)

        psnr      = compute_psnr(original, compressed)
        reduccion = round((1 - comp_size_kb / orig_size_kb) * 100, 1) if orig_size_kb > 0 else 0

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error durante el procesamiento: {str(e)}")

    return JSONResponse({
        "original": {
            "base64":   image_to_base64(original),
            "width":    orig_w,
            "height":   orig_h,
            "size_kb":  orig_size_kb,
            "bits":     24,
        },
        "procesada": {
            "base64":   image_to_base64(compressed, fmt="JPEG"),
            "width":    resolucion,
            "height":   resolucion,
            "size_kb":  comp_size_kb,
            "bits":     bits,
        },
        "metricas": {
            "psnr_db":      psnr,
            "reduccion_pct": reduccion,
        }
    })

@app.get("/")
def root():
    return {"status": "ok", "mensaje": "API Digitalización de Imágenes"}
