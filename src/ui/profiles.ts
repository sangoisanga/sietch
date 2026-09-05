import {
  activeProfile, createProfile, deleteProfile, exportProfile, importProfile,
  listProfiles, renameProfile, setActiveProfile,
} from '../core/profiles'
import { el, escapeHtml } from './dom'
import { setStatus } from './render'
import { STRINGS } from './strings'

export interface ProfilesUi {
  render(): void
  install(onProfileChanged: () => void): void
}

function downloadJson(filename: string, payload: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // revoking synchronously can cancel the download before the browser has read the blob
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function createProfilesUi(): ProfilesUi {
  function render(): void {
    const active = activeProfile()
    el('profileName').textContent = active.name

    el('profileList').innerHTML = listProfiles().map(profile => `<div class="lib">
      <input data-rename="${profile.id}" value="${escapeHtml(profile.name)}" style="flex:1">
      <button class="mini" data-use="${profile.id}"${profile.id === active.id ? ' disabled' : ''}>${profile.id === active.id ? 'Active' : 'Use'}</button>
      <button class="mini" data-delprofile="${profile.id}">✕</button>
    </div>`).join('')
  }

  function install(onProfileChanged: () => void): void {
    const changed = () => { render(); onProfileChanged() }

    el('addProfile').onclick = () => {
      const field = el<HTMLInputElement>('newProfileName')
      if (!field.value.trim()) {
        setStatus(STRINGS.profileNeedsName, 'err')
        return
      }
      const created = createProfile(field.value)
      field.value = ''
      setActiveProfile(created.id)
      changed()
      setStatus(STRINGS.profileSwitched(created.name))
    }

    el('exportProfile').onclick = () => {
      const active = activeProfile()
      downloadJson(`drill-forge-${active.name.toLowerCase().replace(/\s+/g, '-')}.json`, exportProfile(active.id))
      setStatus(STRINGS.profileExported(active.name))
    }

    el('importProfile').onclick = () => el<HTMLInputElement>('importFile').click()

    el<HTMLInputElement>('importFile').onchange = async event => {
      const input = event.target as HTMLInputElement
      const file = input.files?.[0]
      input.value = ''
      if (!file) return
      try {
        const imported = importProfile(await file.text())
        setActiveProfile(imported.id)
        changed()
        setStatus(STRINGS.profileImported(imported.name))
      } catch (error) {
        setStatus(STRINGS.failed(error instanceof Error ? error.message : String(error)), 'err')
      }
    }

    document.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
      if (!button) return

      const { use, delprofile } = button.dataset
      if (use !== undefined) {
        setActiveProfile(use)
        changed()
        setStatus(STRINGS.profileSwitched(activeProfile().name))
      }
      if (delprofile !== undefined) {
        if (!deleteProfile(delprofile)) {
          setStatus(STRINGS.lastProfile, 'err')
          return
        }
        changed()
      }
    })

    document.addEventListener('change', event => {
      const field = (event.target as HTMLElement).closest<HTMLInputElement>('[data-rename]')
      if (!field) return
      renameProfile(field.dataset.rename!, field.value)
      changed()
    })
  }

  return { render, install }
}
