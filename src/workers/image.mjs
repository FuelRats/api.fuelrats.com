import sharp from 'sharp'
import workerpool from 'workerpool'

const formatOptions = {
  webp: {
    quality: 80,
  },
  jpeg: {
    quality: 80,
    chromaSubsampling: '4:4:4',
  },
}

/**
 * Web worker that formats converts an image to an appropriate format and resolution for avatars
 * @param {Uint8Array} imageDataPackage Data buffer package containing image data
 * @param {object} options Output options for the transformed image data
 * @param {number} options.size Output size of the image
 * @param {string} options.format Output format of the image
 * @returns {Promise<Buffer>} A transformed data buffer or an error
 * @throws {Error} Unsupported format or options
 */
function avatarImageFormat (imageDataPackage, options) {
  const { format, size } = options

  return sharp(Buffer.from(imageDataPackage))
    .resize(size, size)
    .toFormat(format, formatOptions[format])
    .toBuffer()
}

workerpool.worker({
  avatarImageFormat,
})

