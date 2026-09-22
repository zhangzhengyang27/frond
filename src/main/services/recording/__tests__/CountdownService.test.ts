 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CountdownService } from '../CountdownService'
import type { BrowserWindow } from 'electron'

function makeWin(): {
  win: {
    isDestroyed: () => boolean
    webContents: { send: (channel: string, payload: unknown) => void }
  }
  sent: { channel: string; payload: unknown }[]
} {
  const sent: { channel: string; payload: unknown }[] = []
  const win = {
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, payload: unknown) => {
        sent.push({ channel, payload })
      }
    }
  }
