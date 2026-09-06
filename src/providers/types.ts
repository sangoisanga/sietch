export interface SettingFieldBase {
  key: string
  label: string
  placeholder?: string
  invalidatesAudio?: boolean
}

export interface TextSettingField extends SettingFieldBase {
  type: 'text' | 'password'
}

export interface SelectSettingField extends SettingFieldBase {
  type: 'select'
  options: { value: string; label: string }[]
}

export type SettingField = TextSettingField | SelectSettingField

export interface ProviderContext {
  config(): Record<string, string>
  update(patch: Record<string, string>): void
}

export interface Describable {
  id: string
  label: string
  settingsFields: SettingField[]
  isConfigured(): boolean
}
