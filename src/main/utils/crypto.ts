/**
 * Frond · 数据加密工具
 *
 * AES-256-GCM 对称加密，用于敏感数据本地存储加密：
 * - 剪贴板历史文本内容
 * - 片段内容
 * - WebDAV 密码
 * - AI API Key
 *
 * 密钥管理：
 * - 首次使用时生成 32 字节随机密钥，存储在 userData/.frond-key
 * - 密钥文件权限设为 0600（仅所有者可读）
 *
 * 加密格式：base64(iv + authTag + ciphertext)，前缀 "enc:" 标识
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import { log } from '../services/LogService'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16
const KEY_LEN = 32
const ENC_PREFIX = 'enc:'

let cachedKey: Buffer | null = null

function getKeyPath(): string {
  return join(app.getPath('userData'), '.frond-key')
}

/** 获取或生成加密密钥 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey

  const keyPath = getKeyPath()
  if (existsSync(keyPath)) {
    try {
      const raw = readFileSync(keyPath, 'utf8').trim()
      cachedKey = Buffer.from(raw, 'hex')
      if (cachedKey.length === KEY_LEN) return cachedKey
    } catch {
      /* 密钥文件损坏，重新生成 */
    }
  }

  // 生成新密钥
  const newKey = randomBytes(KEY_LEN)
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(keyPath, newKey.toString('hex'), { mode: 0o600 })
  try {
    chmodSync(keyPath, 0o600)
  } catch {
    /* 权限设置失败不影响功能 */
  }
  cachedKey = newKey
  return newKey
}

/**
 * 加密文本
 * @param plaintext 明文
 * @returns 加密后的字符串（enc: 前缀 + base64）
 */
export function encryptText(plaintext: string): string {
  if (!plaintext) return plaintext
  // 注意：总是加密。此前「enc: 开头则原样返回」的短路会让恰好以 enc: 开头的
  // 明文不加密落盘；防重复加密由调用方负责（如 AIService 的 startsWith 判断）
  try {
    const key = getKey()
    const iv = randomBytes(IV_LEN)
    const cipher = createCipheriv(ALGO, key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const combined = Buffer.concat([iv, tag, encrypted])
    return ENC_PREFIX + combined.toString('base64')
  } catch (err) {
    // 加密失败绝不能静默降级为明文落盘——那会让「敏感数据加密」变成摆设。
    // 唯一正确的语义是让写入显式失败，密钥环境损坏时尽快暴露。
    throw new Error(`加密失败，拒绝明文落盘: ${(err as Error)?.message ?? String(err)}`)
  }
}

/**
 * 解密文本
 * @param ciphertext 加密后的字符串（enc: 前缀 + base64）
 * @returns 明文；非加密格式原样返回（明文旧数据），解密失败返回空串
 */
export function decryptText(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith(ENC_PREFIX)) return ciphertext
  try {
    const key = getKey()
    const raw = Buffer.from(ciphertext.slice(ENC_PREFIX.length), 'base64')
    if (raw.length < IV_LEN + TAG_LEN) {
      log.error('crypto', 'decrypt failed: payload too short')
      return ''
    }
    const iv = raw.subarray(0, IV_LEN)
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const encrypted = raw.subarray(IV_LEN + TAG_LEN)
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    // 解密失败 = 密钥丢失/轮换或数据损坏，唯一诚实的语义是空串：
    // 返回密文字符串会让 UI 显示乱码、让密码字段拿乱码去静默连接
    log.error('crypto', 'decrypt failed: key mismatch or corrupted data')
    return ''
  }
}

/**
 * 批量加密对象中的指定字段
 * @param obj 目标对象
 * @param fields 需要加密的字段名列表
 * @returns 新对象（指定字段已加密）
 */
export function encryptFields<T extends Record<string, unknown>>(obj: T, fields: string[]): T {
  const result: Record<string, unknown> = { ...obj }
  for (const field of fields) {
    const val = result[field]
    if (typeof val === 'string' && val) {
      result[field] = encryptText(val)
    }
  }
  return result as T
}

/**
 * 批量解密对象中的指定字段
 * @param obj 目标对象
 * @param fields 需要解密的字段名列表
 * @returns 新对象（指定字段已解密）
 */
export function decryptFields<T extends Record<string, unknown>>(obj: T, fields: string[]): T {
  const result: Record<string, unknown> = { ...obj }
  for (const field of fields) {
    const val = result[field]
    if (typeof val === 'string' && val) {
      result[field] = decryptText(val)
    }
  }
  return result as T
}

/** 检查文本是否已加密 */
export function isEncrypted(text: string): boolean {
  return typeof text === 'string' && text.startsWith(ENC_PREFIX)
}

// ─── 云备份文件容器（密码派生密钥，与本地 .frond-key 无关）───

const BAK_MAGIC = 'LEAFBAK1'
const BAK_SALT_LEN = 16
const SCRYPT_N = 16384

/**
 * 把任意二进制（整库快照）用用户密码加密为自描述容器：
 * LEAFBAK1(8B) + salt(16B) + iv(12B) + tag(16B) + ciphertext。
 * 密钥 = scrypt(password, salt)，服务端/网盘侧无法离线爆破弱密码之外的捷径。
 */
export function encryptFileWithPassword(plain: Buffer, password: string): Buffer {
  if (!password || !password.trim()) {
    throw new Error('密码不能为空')
  }
  const salt = randomBytes(BAK_SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: 8, p: 1 })
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([
    Buffer.from(BAK_MAGIC, 'latin1'),
    salt,
    iv,
    tag,
    encrypted
  ])
}

/** 逆操作；密码错误 / 篡改 / 非本产品文件都以人话抛错 */
export function decryptFileWithPassword(blob: Buffer, password: string): Buffer {
  if (!password || !password.trim()) {
    throw new Error('密码不能为空')
  }
  const magicLen = Buffer.byteLength(BAK_MAGIC, 'latin1')
  if (blob.length < magicLen + BAK_SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error('不是 Frond 云备份文件（文件过短或已损坏）')
  }
  if (blob.subarray(0, magicLen).toString('latin1') !== BAK_MAGIC) {
    throw new Error('不是 Frond 云备份文件')
  }
  const salt = blob.subarray(magicLen, magicLen + BAK_SALT_LEN)
  const iv = blob.subarray(magicLen + BAK_SALT_LEN, magicLen + BAK_SALT_LEN + IV_LEN)
  const tag = blob.subarray(magicLen + BAK_SALT_LEN + IV_LEN, magicLen + BAK_SALT_LEN + IV_LEN + TAG_LEN)
  const encrypted = blob.subarray(magicLen + BAK_SALT_LEN + IV_LEN + TAG_LEN)
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: 8, p: 1 })
  try {
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()])
  } catch {
    throw new Error('密码错误或备份文件已损坏')
  }
}
