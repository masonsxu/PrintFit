import { parse } from 'marked'
import { extractBlocks } from './markdown'
import { findOptimalFontSize, clearMeasureCache } from './measure'
import { createControls, getSettings } from './controls'
import { SAMPLES } from './samples'
import type { StyleSettings } from './controls'
import './style.css'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let lastLoadedFont = ''
let a4Wrapper: HTMLElement
let editorsList: HTMLElement
let statusFontSize: HTMLElement
let statusOverflow: HTMLElement
let statusZoom: HTMLElement
let statusPages: HTMLElement
let fitScale = 1
let userZoom = 1

interface PageState {
  editor: HTMLTextAreaElement
  page: HTMLElement
  content: HTMLElement
}

let pageStates: PageState[] = []

function buildDOM(): void {
  const app = document.getElementById('app')!
  app.className = 'app'

  // Top bar
  const topbar = document.createElement('div')
  topbar.className = 'topbar'

  const title = document.createElement('div')
  title.className = 'topbar-title'
  title.textContent = '多页印 PrintFit'

  const statusArea = document.createElement('div')
  statusArea.className = 'topbar-status'

  statusFontSize = document.createElement('span')
  statusFontSize.className = 'status-fontsize'
  statusFontSize.textContent = '—'

  statusOverflow = document.createElement('span')
  statusOverflow.className = 'status-overflow'
  statusOverflow.textContent = '内容溢出'

  statusPages = document.createElement('span')
  statusPages.className = 'status-pages'
  statusPages.textContent = '1 页'

  statusZoom = document.createElement('span')
  statusZoom.className = 'status-zoom'
  statusZoom.textContent = '100%'
  statusZoom.title = '⌘+滚轮缩放，双击重置'

  const btnPrint = document.createElement('button')
  btnPrint.className = 'btn-print'
  btnPrint.textContent = '打印 ⌘P'
  btnPrint.addEventListener('click', preparePrint)

  statusArea.append(statusFontSize, statusZoom, statusPages, statusOverflow, btnPrint)
  topbar.append(title, statusArea)

  // Left panel
  const leftPanel = document.createElement('div')
  leftPanel.className = 'left-panel'

  const editorsHeader = document.createElement('div')
  editorsHeader.className = 'editors-header'
  
  const editorsTitle = document.createElement('span')
  editorsTitle.textContent = '页面编辑区'

  const addPageBtn = document.createElement('button')
  addPageBtn.className = 'btn-add-page'
  addPageBtn.textContent = '+ 添加页面'
  addPageBtn.addEventListener('click', () => addPage())

  editorsHeader.append(editorsTitle, addPageBtn)

  const editorsWrapper = document.createElement('div')
  editorsWrapper.className = 'editors-wrapper'

  editorsList = document.createElement('div')
  editorsList.className = 'editors-list'

  const sampleBar = document.createElement('div')
  sampleBar.className = 'sample-bar'
  
  const sampleLabel = document.createElement('span')
  sampleLabel.textContent = '加载示例:'
  sampleLabel.className = 'sample-label'

  const sampleSelect = document.createElement('select')
  sampleSelect.className = 'sample-select'
  const emptyOpt = document.createElement('option')
  emptyOpt.value = ''
  emptyOpt.textContent = '选择...'
  sampleSelect.appendChild(emptyOpt)
  for (const s of SAMPLES) {
    const opt = document.createElement('option')
    opt.value = s.value
    opt.textContent = s.label
    sampleSelect.appendChild(opt)
  }
  sampleSelect.addEventListener('change', () => {
    const sample = SAMPLES.find(s => s.value === sampleSelect.value)
    if (sample) {
      loadSample(sample.content)
    }
  })

  sampleBar.append(sampleLabel, sampleSelect)
  editorsWrapper.append(sampleBar, editorsList)

  const controlsSection = document.createElement('div')
  controlsSection.className = 'controls-section'

  const controlsHeader = document.createElement('div')
  controlsHeader.className = 'controls-header'
  controlsHeader.textContent = '样式设置'

  const controlsBody = document.createElement('div')
  createControls(controlsBody, () => {
    clearMeasureCache()
    scheduleUpdate()
  })

  controlsSection.append(controlsHeader, controlsBody)
  leftPanel.append(editorsHeader, editorsWrapper, controlsSection)

  // Right panel
  const rightPanel = document.createElement('div')
  rightPanel.className = 'right-panel'

  a4Wrapper = document.createElement('div')
  a4Wrapper.className = 'a4-wrapper'
  rightPanel.appendChild(a4Wrapper)

  app.append(topbar, leftPanel, rightPanel)

  // Auto-scale A4 page to fit the right panel
  const resizeObserver = new ResizeObserver(() => updateA4Scale())
  resizeObserver.observe(rightPanel)

  // Cmd + scroll wheel to zoom preview
  rightPanel.addEventListener('wheel', (e) => {
    if (!e.metaKey) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.95 : 1.05
    userZoom = Math.max(0.3, Math.min(3, userZoom * factor))
    applyScale()
    updateZoomStatus()
  }, { passive: false })

  // Mouse drag to pan preview
  let isDragging = false
  let dragStartX = 0
  let dragStartY = 0
  let scrollStartX = 0
  let scrollStartY = 0

  rightPanel.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    isDragging = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    scrollStartX = rightPanel.scrollLeft
    scrollStartY = rightPanel.scrollTop
    rightPanel.classList.add('dragging')
    e.preventDefault()
  })

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    rightPanel.scrollLeft = scrollStartX - (e.clientX - dragStartX)
    rightPanel.scrollTop = scrollStartY - (e.clientY - dragStartY)
  })

  window.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    rightPanel.classList.remove('dragging')
  })

  // Double-click to reset zoom
  rightPanel.addEventListener('dblclick', () => {
    userZoom = 1
    applyScale()
    updateZoomStatus()
  })

  // Cmd+P to print
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault()
      preparePrint()
    }
  })

  // Initialize with one page
  addPage()
}

function preparePrint(): void {
  document.body.classList.add('is-printing')

  // Remove inline styles for printing
  for (const state of pageStates) {
    state.page.style.transform = ''
    state.page.style.transformOrigin = ''
  }

  window.print()
}

// Restore scale after printing
window.addEventListener('afterprint', () => {
  document.body.classList.remove('is-printing')
  applyScale()
})

function addPage(initialContent = ''): void {
  const index = pageStates.length
  const pageNum = index + 1

  // Create editor
  const editorCard = document.createElement('div')
  editorCard.className = 'editor-card'

  const editorHeader = document.createElement('div')
  editorHeader.className = 'editor-card-header'

  const pageNumLabel = document.createElement('span')
  pageNumLabel.className = 'page-num-label'
  pageNumLabel.textContent = `第 ${pageNum} 页`

  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'btn-delete-page'
  deleteBtn.textContent = '删除'
  deleteBtn.addEventListener('click', () => removePage(index))

  editorHeader.append(pageNumLabel, deleteBtn)

  const textarea = document.createElement('textarea')
  textarea.className = 'editor-textarea'
  textarea.placeholder = `在此输入第 ${pageNum} 页的 Markdown 内容...`
  textarea.spellcheck = false
  textarea.value = initialContent
  textarea.addEventListener('input', scheduleUpdate)

  editorCard.append(editorHeader, textarea)
  editorsList.appendChild(editorCard)

  // Create A4 page
  const page = document.createElement('div')
  page.className = 'a4-page'

  const content = document.createElement('div')
  content.className = 'a4-content'

  page.appendChild(content)
  a4Wrapper.appendChild(page)

  pageStates.push({ editor: textarea, page, content })

  updatePageLabels()
  scheduleUpdate()
}

function removePage(index: number): void {
  if (pageStates.length <= 1) return

  const state = pageStates[index]
  state.editor.closest('.editor-card')!.remove()
  state.page.remove()
  pageStates.splice(index, 1)

  updatePageLabels()
  scheduleUpdate()
}

function updatePageLabels(): void {
  pageStates.forEach((state, i) => {
    const label = state.editor.closest('.editor-card')!.querySelector('.page-num-label')!
    label.textContent = `第 ${i + 1} 页`
    state.editor.placeholder = `在此输入第 ${i + 1} 页的 Markdown 内容...`
  })
  statusPages.textContent = `${pageStates.length} 页`
}

function loadSample(content: string): void {
  // Clear all pages except the first one
  while (pageStates.length > 1) {
    const state = pageStates.pop()!
    state.editor.closest('.editor-card')!.remove()
    state.page.remove()
  }

  // Load content into first page
  if (pageStates.length > 0) {
    pageStates[0].editor.value = content
  }

  scheduleUpdate()
}

const PAGE_W = 794

function updateA4Scale(): void {
  const rightPanel = a4Wrapper.parentElement
  if (!rightPanel) return

  const padding = 32
  const availW = rightPanel.clientWidth - padding * 2

  fitScale = Math.min(availW / PAGE_W, 1)
  applyScale()
}

function applyScale(): void {
  const scale = fitScale * userZoom
  for (const state of pageStates) {
    state.page.style.transform = `scale(${scale})`
    state.page.style.transformOrigin = 'top center'
  }
}

function updateZoomStatus(): void {
  const pct = Math.round(userZoom * 100)
  statusZoom.textContent = `${pct}%`
  statusZoom.classList.toggle('zoom-modified', userZoom !== 1)
}

function scheduleUpdate(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(update, 150)
}

async function update(): Promise<void> {
  const settings = getSettings()

  // Load font if needed
  if (lastLoadedFont !== settings.fontFamily) {
    await Promise.all([
      document.fonts.load(`16px "${settings.fontFamily}"`),
      document.fonts.load(`700 16px "${settings.fontFamily}"`),
    ])
    lastLoadedFont = settings.fontFamily
  }

  let globalOverflow = false
  let displayFontSize = 0

  for (let i = 0; i < pageStates.length; i++) {
    const state = pageStates[i]
    const markdown = state.editor.value

    if (!markdown.trim()) {
      state.content.textContent = ''
      continue
    }

    const blocks = extractBlocks(markdown)
    const { fontSize, overflow } = findOptimalFontSize(blocks, settings)
    if (overflow) globalOverflow = true
    if (i === 0) displayFontSize = fontSize

    const html = await parse(markdown)
    let currentFontSize = fontSize
    applyStyles(state.page, settings, currentFontSize)

    const doc = new DOMParser().parseFromString(html, 'text/html')
    state.content.replaceChildren(...Array.from(doc.body.childNodes).map(n => n.cloneNode(true)))

    // DOM fallback
    const pageStyle = getComputedStyle(state.page)
    const availableHeight = state.page.clientHeight - parseFloat(pageStyle.paddingTop) - parseFloat(pageStyle.paddingBottom)

    if (state.content.scrollHeight > availableHeight && currentFontSize > 6) {
      let lo = 6
      let hi = currentFontSize
      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2
        applyStyles(state.page, settings, mid)
        if (state.content.scrollHeight <= availableHeight) {
          lo = mid
        } else {
          hi = mid
        }
      }
      currentFontSize = Math.floor(lo * 4) / 4
      applyStyles(state.page, settings, currentFontSize)
      if (i === 0) displayFontSize = currentFontSize

      if (currentFontSize <= 6.25 && state.content.scrollHeight > availableHeight) {
        globalOverflow = true
      }
    }
  }

  statusFontSize.textContent = displayFontSize > 0 ? `${displayFontSize.toFixed(1)}px` : '—'
  statusOverflow.classList.toggle('visible', globalOverflow)
  applyScale()
}

function applyStyles(page: HTMLElement, settings: StyleSettings, fontSize: number): void {
  const themeClasses = [
    'theme-classic', 'theme-warm', 'theme-academic', 'theme-editorial',
    'theme-smartisan', 'theme-noir', 'theme-mint', 'theme-ink', 'theme-tech', 'theme-kraft',
  ]
  page.classList.remove(...themeClasses)
  page.classList.add(`theme-${settings.theme}`)

  page.style.padding = `${settings.marginMm}mm`
  page.style.fontFamily = `"${settings.fontFamily}", -apple-system, sans-serif`
  page.style.fontSize = `${fontSize}px`
  page.style.lineHeight = String(settings.lineHeightRatio)
  page.style.setProperty('--ps', `${settings.paragraphSpacing}em`)
  page.style.setProperty('--fi', `${settings.firstLineIndent}em`)
}

document.addEventListener('DOMContentLoaded', () => {
  buildDOM()
})
