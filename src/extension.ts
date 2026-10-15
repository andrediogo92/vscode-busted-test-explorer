import * as vscode from 'vscode'
import { minimatch } from 'minimatch'
import * as config from './config'
import * as cache from './cache'
import * as runner from './runner'
import { hashB64String } from './hash'
import { TestItemType, Test } from './types'
import { parse } from './parser'
import { Logger } from './log'
import { normalizePath } from './utils'

/**
 * Get a test item from the controller associated with a file with tests defined within.
 * @param controller the test controller
 * @param uri a file URI
 * @returns test item associated with the supplied file URI
 */
function getOrCreateFile (controller: vscode.TestController, uri: vscode.Uri): vscode.TestItem {
  const id = hashB64String(normalizePath(uri))
  const existing = controller.items.get(id)
  if (existing) {
    return existing
  }

  const file = controller.createTestItem(id, uri.path.split('/').pop()!, uri)
  file.canResolveChildren = true
  cache.addTestToCache(id, file, { type: TestItemType.file })
  controller.items.add(file)
  return file
}

/**
 * Adds tests present inside a test suite parsed from a test file recursively.
 * @param controller the test controller
 * @param parent a root test item for a file or test suite
 * @param baseName a base name string to associate with the root test item
 * @param definitions all test definitions to generate new tests item to add to the parent
 */
function addTests (
  controller: vscode.TestController, parent: vscode.TestItem,
  baseName: String, definitions: Test[]
) {
  const newIds = new Set<string>()
  const uri = parent.uri!
  definitions.forEach((definition) => {
    const name = `${baseName}${baseName.length > 0 ? ' ' : ''}${definition.name}`
    const id = `${normalizePath(uri)}:${name}`
    Logger.developerLog(`[Busted] Add Test: ${id}`)

    const hashedId = hashB64String(id)
    newIds.add(hashedId)
    const test = controller.createTestItem(hashedId, definition.name, uri)
    test.range = new vscode.Range(
      new vscode.Position(definition.loc.start.line - 1, definition.loc.start.column),
      new vscode.Position(definition.loc.end.line - 1, definition.loc.end.column)
    )
    cache.addTestToCache(hashedId, test, {
      type: definition.type,
      name
    })
    parent.children.add(test)

    if (definition.type === TestItemType.testSuite) {
      addTests(controller, test, name, definition.child)
    }
  })

  const intersect = new Set<string>()
  parent.children.forEach((test) => {
    if (!newIds.has(test.id)) {
      intersect.add(test.id)
    }
  })

  newIds.clear()
  intersect.forEach((id) => parent.children.delete(id))
  intersect.clear()
}

/**
 * Parse tests in a test item file and add them into the test cache.
 * @param controller the main test controller
 * @param file the test file which contains busted test definitions
 * @param contents the contents of the test file as a string
 * @returns
 */
async function parseTestsInFileContents (
  controller: vscode.TestController, file: vscode.TestItem, contents?: string
): Promise<void> {
  if (!file.uri) {
    return
  }

  if (!contents) {
    contents = (await vscode.workspace.fs.readFile(file.uri)).toString()
  }

  try {
    const tests = parse(contents)
    addTests(controller, file, '', tests)
  } catch (err) {
    // Catch parsing issue while editing
  }
}

/**
 * Check if the text document supplied is a lua file with busted tests, and if so attempt to parse the tests within its contents.
 * @param controller the main controller
 * @param text the text document to parse
 */
function parseTestsInDocument (
  controller: vscode.TestController, text: vscode.TextDocument
) {
  if (text.uri.scheme === 'file' && minimatch(text.uri.fsPath, config.getFilePattern())) {
    Logger.developerLog('[Busted] Parse:', text.uri.fsPath)
    parseTestsInFileContents(controller, getOrCreateFile(controller, text.uri), text.getText())
  }
}

/**
 * Discovers all files in current workspace and sets up file watchers for every workspace folder
 * continually searching for busted spec test files.
 * @param controller the main controller
 * @returns An array of file watchers for every workspace folder
 */
async function discoverAllFilesInWorkspace (
  controller: vscode.TestController
) {
  if (!vscode.workspace.workspaceFolders) {
    return [] // handle the case of no open folders
  }

  return Promise.all(
    vscode.workspace.workspaceFolders.map(async workspaceFolder => {
      const pattern = new vscode.RelativePattern(workspaceFolder, config.getFilePattern())
      const watcher = vscode.workspace.createFileSystemWatcher(pattern)

      // When files are created, make sure there's a corresponding "file" node in the tree
      watcher.onDidCreate(uri => getOrCreateFile(controller, uri))
      // When files change, re-parse them. Note that you could optimize this so
      // that you only re-parse children that have been resolved in the past.
      watcher.onDidChange(uri => parseTestsInFileContents(controller, getOrCreateFile(controller, uri)))
      // And, finally, delete TestItems for removed files. This is simple, since
      // we use the URI as the TestItem's ID.
      watcher.onDidDelete(uri => controller.items.delete(hashB64String(normalizePath(uri))))

      for (const file of await vscode.workspace.findFiles(pattern)) {
        getOrCreateFile(controller, file)
      }

      return watcher
    })
  )
}

async function lateResolveTests (
  controller: vscode.TestController, test: vscode.TestItem
) {
  const testData = cache.getTestData(test)
  if (testData.type === TestItemType.file && test.children.size === 0) {
    await parseTestsInFileContents(controller, test)
  }
}

/**
 * Take a test item and collect all children recursively into the included filter set
 * and enqueue those tests into the test run.
 * @param run a test run
 * @param test current test item/suite being recursively included
 * @param files the set of files uris with tests to include
 * @param filter the set of test names to include via filter arguments
 */
function includeTest (
  run: vscode.TestRun, test: vscode.TestItem,
  queue: Set<vscode.TestItem>,
  files: Set<vscode.Uri>, filter: Set<string>
) {
  const testData = cache.getTestData(test)

  if (test.children.size > 0) {
    test.children.forEach((item, _) => includeTest(run, item, queue, files, filter))
  } else if (test.uri) {
    queue.add(test)
    files.add(test.uri)
    if (testData.name) {
      filter.add(testData.name)
    }
  }
}

/**
 * Take a test item and collect all its children recursively into to the exclusion list.
 * Note: currently unused.
 * @param test current test item/suite being excluded
 * @param files the set of file uris with tests to include
 * @param filterOut the set of test names to exclude from the run
 */
function excludeTest (
  test: vscode.TestItem, queue: Set<vscode.TestItem>,
  files: Set<vscode.Uri>, filter: Set<string>
) {
  if (test.uri && files.has(test.uri)) {
    const testData = cache.getTestData(test)
    queue.delete(test)
    if (testData.type === TestItemType.file) {
      test.children.forEach((item, _) => excludeTest(item, queue, files, filter))
      files.delete(test.uri)
    } else if (testData.name) {
      filter.delete(testData.name)
    }
  }
}

/**
 * The run handler that resolves all tests than sends it to a runner to execute busted.
 * @param context the extension context
 * @param controller the main controller
 * @param request the main run request
 * @param token a cancelation token
 */
async function runHandler (
  context: vscode.ExtensionContext,
  controller: vscode.TestController,
  request: vscode.TestRunRequest,
  token: vscode.CancellationToken
) {
  const run = controller.createTestRun(request)

  const files = new Set<vscode.Uri>()
  const queue = new Set<vscode.TestItem>()
  const filter = new Set<string>()

  if (request.include) {
    await Promise.all(request.include.map(item => lateResolveTests(controller, item)))
    request.include.forEach(item => includeTest(run, item, queue, files, filter))
  } else {
    const tests: vscode.TestItem[] = []
    controller.items.forEach(test => tests.push(test))
    await Promise.all(tests.map(item => lateResolveTests(controller, item)))
    tests.forEach(item => includeTest(run, item, queue, files, filter))
  }

  if (request.exclude) {
    request.exclude.forEach(item => excludeTest(item, queue, files, filter))
  }

  queue.forEach(test => run.enqueued(test))

  await runner.execute(context, run, files, filter, token)
}

export function activate (context: vscode.ExtensionContext) {
  const controller = vscode.tests.createTestController('busted-test-explorer', 'Busted Test Explorer')
  context.subscriptions.push(controller)

  controller.resolveHandler = async test => {
    if (!test) {
      await discoverAllFilesInWorkspace(controller)
    } else {
      await parseTestsInFileContents(controller, test)
    }
  }

  vscode.workspace.onDidOpenTextDocument(doc => parseTestsInDocument(controller, doc))
  vscode.workspace.onDidChangeTextDocument(doc => parseTestsInDocument(controller, doc.document))

  controller.createRunProfile(
    'Run',
    vscode.TestRunProfileKind.Run,
    (request, token) => runHandler(context, controller, request, token)
  )

  Logger.developerLog('[Busted] Activated')
}

// this method is called when your extension is deactivated
export function deactivate () { }
