// Kitly Example Plugin — CommonJS entry loaded in the MAIN process by pluginHost.
// Demonstrates: registering local (non-provider) operations with an `execute`
// function, reading plugin settings, and multi-image source inputs.
'use strict'

/**
 * @param {object} context - injected by Kitly's pluginHost
 *   context.registerOperation(definition, { execute }) — definition is a standard
 *     OperationDefinition (id MUST be prefixed with the plugin id); `execute`
 *     receives { inputs, sourceFiles: [{ path, kind }], outputDir, settings }
 *     and returns [{ fileName, bytes: Buffer, kind }].
 *   context.getSettings() — resolved values of the manifest's contributes.settings.
 *   context.log(message) — namespaced logger.
 */
function activate(context) {
  const { nativeImage } = require('electron')

  // ── 1. Add Text: renders a text overlay onto an image via an offscreen window ──
  context.registerOperation(
    {
      id: 'kitly-example.image.add-text',
      category: 'image',
      provider: 'local',
      endpoint: 'local/add-text',
      title: 'Add Text (Example)',
      description: 'Overlays text on an image — demonstrates a local plugin operation.',
      sourceInputs: [{ key: 'image', label: 'Image', acceptedKinds: ['image'], falField: 'image', required: true }],
      parameters: [
        { key: 'text', label: 'Text', type: 'text', required: true },
        { key: 'size', label: 'Font Size', type: 'number', default: 48, min: 8, max: 256 },
        { key: 'position', label: 'Position', type: 'select', default: 'bottom', options: [
          { value: 'top', label: 'Top' }, { value: 'center', label: 'Center' }, { value: 'bottom', label: 'Bottom' }
        ] }
      ],
      outputs: [{ itemPath: '', role: 'generatedImage', kind: 'image', defaultExtension: 'png', folder: 'images/generated' }]
    },
    {
      async execute({ inputs, sourceFiles, settings }) {
        const { BrowserWindow } = require('electron')
        const source = nativeImage.createFromPath(sourceFiles[0].path)
        const { width, height } = source.getSize()
        const text = String(inputs.text || settings.defaultText || 'Kitly')
        const size = Number(inputs.size) || 48
        const y = inputs.position === 'top' ? size * 1.2 : inputs.position === 'center' ? height / 2 : height - size * 0.6
        // Offscreen render: base image + SVG text layer, captured at native size.
        const html = `<body style="margin:0"><div style="position:relative;width:${width}px;height:${height}px">
          <img src="${source.toDataURL()}" style="position:absolute;inset:0"/>
          <svg style="position:absolute;inset:0" width="${width}" height="${height}">
            <text x="50%" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${size}"
              fill="#fff" stroke="#000" stroke-width="${Math.max(1, size / 24)}" paint-order="stroke">${text
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
          </svg></div></body>`
        const win = new BrowserWindow({ show: false, width, height, webPreferences: { offscreen: true } })
        try {
          await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
          await new Promise((r) => setTimeout(r, 150))
          const shot = await win.webContents.capturePage({ x: 0, y: 0, width, height })
          return [{ fileName: 'add-text.png', bytes: shot.toPNG(), kind: 'image' }]
        } finally {
          win.destroy()
        }
      }
    }
  )

  // ── 2. Create Image Grid: pure-pixel compositing, multiple images + columns ──
  context.registerOperation(
    {
      id: 'kitly-example.image.grid',
      category: 'image',
      provider: 'local',
      endpoint: 'local/image-grid',
      title: 'Create Image Grid (Example)',
      description: 'Tiles multiple images into a grid — demonstrates multi-image inputs and numeric params.',
      sourceInputs: [{ key: 'images', label: 'Images', acceptedKinds: ['image'], falField: 'images', multiple: true, required: true }],
      parameters: [
        { key: 'columns', label: 'Columns', type: 'number', default: 2, min: 1, max: 8, required: true },
        { key: 'cellSize', label: 'Cell Size (px)', type: 'number', default: 512, min: 64, max: 2048 }
      ],
      outputs: [{ itemPath: '', role: 'generatedImage', kind: 'image', defaultExtension: 'png', folder: 'images/generated' }]
    },
    {
      async execute({ inputs, sourceFiles, settings }) {
        const columns = Math.max(1, Number(inputs.columns) || 2)
        const cell = Math.max(64, Number(inputs.cellSize) || 512)
        const gap = Number(settings.gridGap) || 0
        const rows = Math.ceil(sourceFiles.length / columns)
        const outW = columns * cell + gap * (columns - 1)
        const outH = rows * cell + gap * (rows - 1)
        const out = Buffer.alloc(outW * outH * 4) // BGRA, transparent
        sourceFiles.forEach((file, index) => {
          const img = nativeImage.createFromPath(file.path).resize({ width: cell, height: cell })
          const bmp = img.toBitmap()
          const ox = (index % columns) * (cell + gap)
          const oy = Math.floor(index / columns) * (cell + gap)
          for (let yy = 0; yy < cell; yy += 1) {
            const src = yy * cell * 4
            const dst = ((oy + yy) * outW + ox) * 4
            bmp.copy(out, dst, src, src + cell * 4)
          }
        })
        const png = nativeImage.createFromBitmap(out, { width: outW, height: outH }).toPNG()
        context.log(`grid: ${sourceFiles.length} images -> ${columns}x${rows}`)
        return [{ fileName: 'image-grid.png', bytes: png, kind: 'image' }]
      }
    }
  )

  context.log('Kitly Example Plugin activated')
}

module.exports = { activate }
