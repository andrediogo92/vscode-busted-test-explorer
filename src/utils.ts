import * as vscode from 'vscode'
import { normalize } from 'path'
import { Report } from './types'

export function rebuildId (report: Report) {
  return `${report.testSource}${report.testSource.length > 0 ? ':' : ''}${report.name}`
}

export function quoteIfWindows (s: string): string {
  if (process.platform !== 'win32') return s
  if (/^".*"$/.test(s)) return s
  return `"${s.replace(/"/g, '\\"')}"`
}

export function escapeLuaPatternMagicCharacters (s: string): string {
  return s.replace(/[().%+\-*?[\]^$]/g, '%$&')
}

export function unescapeLuaPatternMagicCharacters (s: string): string {
  return s.replace(/%([().%+\-*?[\]^$])/g, '$1')
}

export function unescapeSlashes (s: string) {
  return s.replace(/\\(.)/g, '$1')
}

export function normalizePath (uri: vscode.Uri) {
  return normalize(uri.fsPath).replace(/^\\/, '')
}
