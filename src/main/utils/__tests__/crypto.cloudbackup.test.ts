import { describe, it, expect } from 'vitest'
import { encryptFileWithPassword, decryptFileWithPassword } from '../crypto'

/**
 * 云备份的文件级密码加密容器：
 * 容器 = LEAFBAK1(8B) + salt(16B) + iv(12B) + tag(16B) + ciphertext
 * 密钥由 scrypt(password, salt) 派生——本地 .leaf-key 不随备份上云。
 */
describe('encryptFileWithPassword / decryptFileWithPassword', () => {
  it('往返：任意二进制内容一致', () => {
    const plain = Buffer.from([0, 1, 2, 250, 251, 255, 78, 97])
    const blob = encryptFileWithPassword(plain, 'hunter2')
    expect(blob.subarray(0, 8).toString('latin1')).toBe('LEAFBAK1')
    const out = decryptFileWithPassword(blob, 'hunter2')
    expect(Buffer.compare(out, plain)).toBe(0)
  })

  it('大缓冲（模拟整库快照 MB 级）往返', () => {
    const plain = Buffer.alloc(3 * 1024 * 1024)
    for (let i = 0; i < plain.length; i += 4096) plain[i] = i % 251
    const out = decryptFileWithPassword(encryptFileWithPassword(plain, 'p'), 'p')
    expect(Buffer.compare(out, plain)).toBe(0)
  })

  it('错误密码抛错（GCM 认证失败），不返回垃圾数据', () => {
    const blob = encryptFileWithPassword(Buffer.from('secret'), 'right')
    expect(() => decryptFileWithPassword(blob, 'wrong')).toThrow(/密码错误或备份文件已损坏/)
  })

  it('密文被篡改抛错', () => {
    const blob = encryptFileWithPassword(Buffer.from('secret'), 'p')
    blob[blob.length - 1] ^= 0xff
    expect(() => decryptFileWithPassword(blob, 'p')).toThrow()
  })

  it('魔法数不对（非 Leaf 备份文件）抛错', () => {
    const fake = Buffer.concat([Buffer.from('NOTMAGIC'), Buffer.alloc(64)])
    expect(() => decryptFileWithPassword(fake, 'p')).toThrow(/不是 Leaf 云备份文件/)
  })

  it('文件过短直接抛错', () => {
    expect(() => decryptFileWithPassword(Buffer.alloc(10), 'p')).toThrow()
  })

  it('空密码在加密端即拒绝', () => {
    expect(() => encryptFileWithPassword(Buffer.from('x'), '')).toThrow(/密码不能为空/)
    expect(() => encryptFileWithPassword(Buffer.from('x'), '   ')).toThrow(/密码不能为空/)
  })

  it('同密码同明文两次加密产生不同密文（随机 salt/iv）', () => {
    const plain = Buffer.from('same')
    const a = encryptFileWithPassword(plain, 'p')
    const b = encryptFileWithPassword(plain, 'p')
    expect(a.equals(b)).toBe(false)
  })
})
