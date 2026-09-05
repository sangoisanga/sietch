import { describe, expect, it } from 'vitest'
import { providers, isLlmConfigured, themeFallback } from './actions'

// v2 briefly wired providers through a setter nobody called, so every LLM path
// threw "Cannot read properties of undefined (reading 'activeLlm')"
describe('providers wiring', () => {
  it('is ready at module load, with no init call to remember', () => {
    expect(providers.activeLlm()).toBeDefined()
    expect(providers.activeTts()).toBeDefined()
  })

  it('answers isLlmConfigured without throwing when no key is set', () => {
    expect(isLlmConfigured()).toBe(false)
  })

  it('falls back to a theme when the input is blank', () => {
    expect(themeFallback('  ')).toBeTruthy()
  })
})
