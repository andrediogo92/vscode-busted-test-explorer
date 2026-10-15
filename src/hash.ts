import { Base64 } from 'js-base64'
import { XXHash3 } from 'xxhash-addon'

export function hashB64Buffer (buf: Buffer<ArrayBufferLike>) {
  return Base64.fromUint8Array(XXHash3.hash(buf))
}

export function hashB64Array (arr: Uint8Array) {
  const buf = Buffer.from(arr)
  return hashB64Buffer(buf)
}

export function hashB64String (s: string) {
  const buf = Buffer.from(s)
  return hashB64Buffer(buf)
}
