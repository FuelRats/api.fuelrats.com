import workerpool from 'workerpool'
import sharp from 'sharp'

import {
  UnsupportedMediaAPIError
} from '../classes/APIError'

const profileImageMax = 100

/**
 * Web worker that formats converts an image to an appropriate format and resolution for avatars
 * @param imageDataPackage Data buffer package containing image data
 * @returns {Promise<any>} A transformed data buffer or an error
 */
async function avatarImageResize (imageDataPackage) {
  try {
    return await sharp(Buffer.from(imageDataPackage.data))
      .resize(profileImageMax, profileImageMax)
      .jpeg({
        quality: 80,
        chromaSubsampling: '4:4:4'
      })
      .toBuffer()
  } catch (ex) {
    throw new UnsupportedMediaAPIError({ pointer: '/data' })
  }
}

workerpool.worker({
  avatarImageResize
})
