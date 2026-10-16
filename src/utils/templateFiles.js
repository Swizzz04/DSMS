/**
 * templateFiles.js — turns an uploaded format file into a page image
 *
 * PDF   → first page rendered with pdfjs-dist (dynamically imported, never in the main bundle)
 * Image → downscaled to the same working width
 *
 * Both come back as one JPEG data URL plus the real page size in points, so a
 * print at "actual size" lines up with the paper the registrar uploaded.
 *
 * Requires:  npm install pdfjs-dist@4.10.38
 */

import { DOCUMENT_FORMAT_LIMITS } from '../config/appConfig'

const PX_PER_PT = 96 / 72 // CSS pixels per point; used to size image uploads

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result)
    r.onerror = () => reject(new Error('Could not read the file.'))
    r.readAsArrayBuffer(file)
  })
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result)
    r.onerror = () => reject(new Error('Could not read the file.'))
    r.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('This image could not be opened.'))
    img.src = src
  })
}

/** Draws a source onto a white canvas at the working width and returns a JPEG data URL. */
function toJpeg(draw, srcW, srcH) {
  const { renderWidthPx, jpegQuality } = DOCUMENT_FORMAT_LIMITS
  const scale  = renderWidthPx / srcW
  const canvas = document.createElement('canvas')
  canvas.width  = Math.round(srcW * scale)
  canvas.height = Math.round(srcH * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // transparent PDFs/PNGs would turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return Promise.resolve(draw(ctx, scale, canvas)).then(() => canvas.toDataURL('image/jpeg', jpegQuality))
}

async function pdfToImage(file) {
  let pdfjs, workerUrl
  try {
    pdfjs     = await import('pdfjs-dist')
    workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  } catch {
    throw new Error('PDF support is not installed yet. Run "npm install pdfjs-dist@4.10.38" and restart the dev server.')
  }
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const data = await readAsArrayBuffer(file)
  let doc
  try {
    doc = await pdfjs.getDocument({ data }).promise
  } catch (e) {
    if (e?.name === 'PasswordException') throw new Error('This PDF is password protected. Remove the password and upload it again.')
    throw new Error('This PDF could not be opened. Try saving it again and upload the new copy.')
  }

  const page = await doc.getPage(1)
  const base = page.getViewport({ scale: 1 }) // 1 unit = 1 pt
  const image = await toJpeg(async (ctx, scale, canvas) => {
    const viewport = page.getViewport({ scale })
    await page.render({ canvasContext: ctx, viewport }).promise
  }, base.width, base.height)

  const pages = doc.numPages
  doc.destroy?.()
  return { image, pageWidthPt: base.width, pageHeightPt: base.height, pages }
}

async function imageToImage(file) {
  const url = await readAsDataUrl(file)
  const img = await loadImage(url)
  const image = await toJpeg(ctx => ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height), img.naturalWidth, img.naturalHeight)
  // A pasted/scanned image has no real paper size: treat it as its pixel size at 96 dpi,
  // capped to the A4 width so it prints at a sensible scale.
  const defW = DOCUMENT_FORMAT_LIMITS.defaultPageWidthPt
  const natW = img.naturalWidth / PX_PER_PT
  const pageWidthPt  = natW > defW * 1.5 || natW < defW * 0.4 ? defW : natW
  const pageHeightPt = pageWidthPt * (img.naturalHeight / img.naturalWidth)
  return { image, pageWidthPt, pageHeightPt, pages: 1 }
}

/**
 * @param {File} file  PDF, PNG, JPG or WebP
 * @returns {Promise<{image:string,pageWidthPt:number,pageHeightPt:number,pages:number,fileName:string}>}
 */
export async function fileToTemplateImage(file) {
  if (!file) throw new Error('Choose a file first.')
  const maxBytes = DOCUMENT_FORMAT_LIMITS.maxFileMB * 1024 * 1024
  if (file.size > maxBytes) throw new Error(`The file is larger than ${DOCUMENT_FORMAT_LIMITS.maxFileMB} MB.`)

  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  const isImg = /^image\/(png|jpe?g|webp)$/i.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)
  if (!isPdf && !isImg) throw new Error('Upload a PDF, PNG, JPG or WebP file.')

  const result = isPdf ? await pdfToImage(file) : await imageToImage(file)
  return { ...result, fileName: file.name }
}
