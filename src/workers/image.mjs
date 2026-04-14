import sharp from 'sharp'

const formatOptions = {
  webp: {
    quality: 80,
  },
  jpeg: {
    quality: 80,
    chromaSubsampling: '4:4:4',
  },
}

self.onmessage = async (event) => {
  const { id, imageData, options } = event.data
  try {
    const { format, size } = options
    const result = await sharp(Buffer.from(imageData))
      .resize(size, size)
      .toFormat(format, formatOptions[format])
      .toBuffer()
    postMessage({ id, result })
  } catch (error) {
    postMessage({ id, error: error.message })
  }
}
