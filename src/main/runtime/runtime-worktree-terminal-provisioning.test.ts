import { describe, expect, it, vi } from 'vitest'
import {
  provisionWorktreeTerminals,
  type WorktreeTerminalProvisioningHost
} from './runtime-worktree-terminal-provisioning'

const setup = { runnerScriptPath: '/repo/.orca/setup.sh', envVars: {} }

function createHost(settings: Record<string, unknown>): {
  host: WorktreeTerminalProvisioningHost
  titles: () => (string | undefined)[]
} {
  const createTerminal = vi.fn<WorktreeTerminalProvisioningHost['createTerminal']>(async () => ({
    handle: `term-${createTerminal.mock.calls.length}`
  }))
  return {
    host: {
      canSpawn: () => true,
      createTerminal,
      splitTerminal: vi.fn(async () => ({ handle: 'split' })),
      setTabColor: vi.fn(async () => {}),
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: provisioning reads only the optional keys each test supplies.
      getSettings: () => settings as ReturnType<WorktreeTerminalProvisioningHost['getSettings']>,
      getPtyId: () => undefined,
      recordSetupCompletionToken: vi.fn()
    },
    titles: () => createTerminal.mock.calls.map(([, options]) => options.title)
  }
}

function provision(host: WorktreeTerminalProvisioningHost, withSetup = true) {
  return provisionWorktreeTerminals(host, {
    worktreeSelector: 'id:wt-1',
    worktreeId: 'wt-1',
    worktreePath: '/repo/wt-1',
    ...(withSetup ? { setup } : {}),
    hasStartupTerminal: false,
    setupCommandPlatform: 'posix'
  })
}

describe('provisionWorktreeTerminals with the "None" default', () => {
  const none = { defaultTuiAgent: 'blank', newWorkspaceSetupOnly: true }

  it('opens only the Setup tab', async () => {
    const { host, titles } = createHost(none)
    await expect(provision(host)).resolves.toMatchObject({ setupSpawned: true })
    expect(titles()).toEqual(['Setup'])
  })

  it('keeps the blank terminal for a plain blank default', async () => {
    const { host, titles } = createHost({ defaultTuiAgent: 'blank' })
    await provision(host)
    expect(titles()).toEqual([undefined, 'Setup'])
  })

  it('falls back to a blank terminal when no setup runs', async () => {
    const { host, titles } = createHost(none)
    await provision(host, false)
    expect(titles()).toEqual([undefined])
  })

  it('keeps the shell a split setup needs', async () => {
    const { host, titles } = createHost({ ...none, setupScriptLaunchMode: 'split-vertical' })
    await provision(host)
    expect(titles()).toEqual([undefined])
    expect(host.splitTerminal).toHaveBeenCalledTimes(1)
  })
})
