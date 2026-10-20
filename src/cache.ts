import * as vscode from 'vscode'
import { TestItemData } from './types'

const watchers = new Map<vscode.Uri, vscode.FileSystemWatcher>()
const testDatas = new WeakMap<vscode.TestItem, TestItemData>()
const tests = new Map<string, WeakRef<vscode.TestItem>>()
const listeners: vscode.Disposable[] = []

export function clearDisposables () {
  clearWatchers()
  listeners.forEach(disposable => disposable.dispose())
}

export function clearWatchers () {
  for (const watcher of watchers.values()) {
    watcher.dispose()
  }
}

export function addListener (listener: vscode.Disposable) {
  listeners.push(listener)
}

export function addWatcher (uri: vscode.Uri, watcher: vscode.FileSystemWatcher) {
  watchers.set(uri, watcher)
}

export function addTestToCache (id: string, test: vscode.TestItem, data: TestItemData) {
  testDatas.set(test, data)
  tests.set(id, new WeakRef(test))
}

export function getWatcher (uri: vscode.Uri): vscode.FileSystemWatcher | undefined {
  return watchers.get(uri)
}

export function getTestData (test: vscode.TestItem): TestItemData {
  return testDatas.get(test)!
}

export function getTest (id: string): vscode.TestItem | undefined {
  const ref = tests.get(id)
  if (ref) {
    return ref.deref()
  }
}
