export interface LlmProvider {
  id: string
  label: string
  isConfigured(): boolean
  generateJson<T>(prompt: string, temperature: number): Promise<T>
}
