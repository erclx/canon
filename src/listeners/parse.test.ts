import { describe, expect, it } from 'vitest'
import { parseLsofListeners, parseProcNetTcp } from '@/listeners/parse'

describe('parseLsofListeners', () => {
  it('should read each listening port with the pid that owns it', () => {
    const text = [
      'p100',
      'f20',
      'n*:5173',
      'p200',
      'f7',
      'n127.0.0.1:4321',
      'f8',
      'n[::1]:4321',
    ].join('\n')

    const listeners = parseLsofListeners(text)

    expect(listeners).toEqual([
      { pid: 100, port: 5173 },
      { pid: 200, port: 4321 },
      { pid: 200, port: 4321 },
    ])
  })
})

describe('parseProcNetTcp', () => {
  it('should read the inode of each listening socket and skip other states', () => {
    const text = [
      '  sl  local_address rem_address   st tx_queue rx_queue uid timeout inode',
      '   0: 0100007F:1435 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 55501 1 0000000000000000 100 0 0 10 0',
      '   1: 0100007F:1F90 0100007F:D2A0 01 00000000:00000000 00:00000000 00000000  1000        0 55502 1 0000000000000000 20 4 30 10 -1',
    ].join('\n')

    const sockets = parseProcNetTcp(text)

    expect(sockets).toEqual([{ port: 5173, inode: '55501' }])
  })
})
