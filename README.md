# TP Integrador — Digitalización de Imágenes
**Comunicación de Datos 2026 · UTN FRLP**  
Grupo: Azzad Gonzalo · Albanese Juan · Biscayart Bautista · Buffa Jenaro

---

## Propuesta 3 — Digitalización de Imágenes

Aplicación web que simula el proceso de digitalización de imágenes analógicas mediante muestreo espacial, cuantización de color y compresión JPEG.

**Arquitectura:** Cliente-Servidor (Frontend React + Backend FastAPI)


frontend/   → React + Vite  (puerto 5173)
backend/    → FastAPI + Python  (puerto 8000)

---

## Requisitos previos

- **Node.js** v18 o superior → https://nodejs.org
- **Python** 3.10 o superior → https://python.org

---

## Instrucciones de ejecución

### 1. Clonar el repositorio

bash
git clone <URL_DEL_REPO>
cd tp-comunicaciones


### 2. Levantar el Backend

bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload


El backend queda corriendo en → **http://localhost:8000**

### 3. Levantar el Frontend (nueva terminal)

bash
cd frontend
npm install
npm run dev


El frontend queda corriendo en → **http://localhost:5173**

### 4. Usar la aplicación

Abrir el navegador en **http://localhost:5173**

---

## Funcionalidades implementadas

| Funcionalidad | Estado |
|---|---|
| Carga de imágenes (PNG, JPG, BMP, WEBP) | ✅ |
| Muestreo con distintos niveles de resolución (100×100 a 1000×1000) | ✅ |
| Cuantización con distintas profundidades de bits (1, 2, 4, 8, 24 bits) | ✅ |
| Compresión JPEG configurable (1–100%) | ✅ |
| Comparación visual original vs. digitalizada | ✅ |
| Métricas: PSNR, reducción de tamaño | ✅ |
| Descarga de imagen procesada | ✅ |

---

## Conceptos teóricos aplicados

- **Muestreo:** reducción de resolución espacial (Teorema de Nyquist)
- **Cuantización:** reducción de niveles de color por canal (2^n niveles)
- **Compresión con pérdida:** JPEG con calidad configurable
- **PSNR:** métrica de calidad de reconstrucción (dB)
