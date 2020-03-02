import sharp from 'sharp'
import workerpool from 'workerpool'

const profileImageMax = 256

/**
 * Web worker that formats converts an image to an appropriate format and resolution for avatars
 * @param {Uint8Array} imageDataPackage Data buffer package containing image data
 * @returns {Promise<any>} A transformed data buffer or an error
 */
function avatarImageResize (imageDataPackage) {
  return sharp(Buffer.from(imageDataPackage))
    .resize(profileImageMax, profileImageMax)
    .jpeg({
      quality: 80,
      chromaSubsampling: '4:4:4',
    })
    .toBuffer()
}

workerpool.worker({
  avatarImageResize,
})

