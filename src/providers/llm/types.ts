import type { Describable } from '../types'

export interface LlmProvider extends Describable {
  generateJson<T>(prompt: string, temperature: number): Promise<T>
}
