import * as vscode from 'vscode'
import { spawn } from 'child_process'
import * as readline from 'readline'
import * as config from './config'
import * as cache from './cache'
import * as path from 'path'
import { TestReport, TestResult } from './types'
import { Logger } from './log'
import { escapeLuaPatternMagicCharacters, quoteIfWindows, rebuildId } from './utils'
import { hashB64String } from './hash'

const MAGIC = '[VSCODE-BUSTED-REPORT]'

/**
 * Starts a timer to catch "hung" tests that do not allow the GUI to unlock due
 * to endless waiting.
 * @param child the busted child process
 * @param ms the timeout in milliseconds
 * @param run the current test run to watch
 * @param currentTest the current test to watch
 */
function withIdleWatchdog (
  child: ReturnType<typeof spawn>,
  ms: number, run: vscode.TestRun,
  currentTest: vscode.TestItem | undefined
): void {
  let last = Date.now()
  const bump = () => { last = Date.now() }

  // whenever stdout/stderr sends data update timestamp
  child.stdout?.on('data', (_d) => bump())
  child.stderr?.on('data', (_d) => bump())
  child.on('close', () => clearInterval(timer))
  child.on('error', () => clearInterval(timer))

  const timer = setInterval(() => {
    try {
      if (Date.now() - last > ms) {
        const msg = `[Busted] ⏱ No output for ${ms}ms — killing process ❌`
        // log to run (Output panels)
        try {
          run.appendOutput(msg + '\r\n', undefined, currentTest)
        } catch {
          // just in case run.appendOutput is not available
          // continue
        }

        // if there is an active testItem, mark it as errored
        if (currentTest) {
          const message = new vscode.TestMessage(msg)
          try {
            run.errored(currentTest, message)
          } catch (e) { /* ignore */ }
        }

        // kill busted process
        try {
          child.kill()
        } catch (e) {
          // If we got here kill failed nothing to do if we can't kill the
          // process really. Just terminate the timer and carry on.
        }
        clearInterval(timer)
      }
    } catch (err) {
      // protect against unexpected errors inside the timer
      try {
        run.appendOutput(`Watchdog error: ${String(err)}\r\n`)
      } catch { }
      clearInterval(timer)
    }
  }, 1000)
}

/**
 * Forms the path to the executable, depending on the selected profile.
 * @param profile the profile by string key, defaults to local executable if the profile is unknown
 * @returns the executable path as a string
 */
function getExecutable (profile : string) : string {
  let bustedExecutable: string
  switch (profile) {
    case 'wsl':
      bustedExecutable = vscode.workspace.getConfiguration('busted-test-explorer').get<string>('wslExecutable', 'wsl busted')
      break
    case 'docker':
      bustedExecutable = vscode.workspace.getConfiguration('busted-test-explorer').get<string>('dockerExecutable', 'docker run --rm my-lua busted')
      break
    default:
      bustedExecutable = config.getExecutable() // default path (bat/exe)
      break
  }

  Logger.developerLog('[Busted] 🚀 Profile:', profile)
  Logger.info(`[Busted] 🚀 Using profile: ${profile}`)

  return bustedExecutable
}

/**
 * Transmits messages to a special tab with test results.
 * @param run the test run to print to
 * @param msg the message to print
 * @param location a location in the test code
 * @param test a test item associated with the result
 */
function printToResultConsole (
  run: vscode.TestRun, msg : string,
  location?: vscode.Location, test?: vscode.TestItem
) {
  run.appendOutput(msg + '\r\n', location, test)
}

/**
 * Formats error message
 * @param test a test item where the error happened
 * @param report a report object associated with the test
 */
function getErrorMessage (
  test: vscode.TestItem, report: TestReport
) {
  if (report.message) {
    const diff = report.message.match(/[^:]*: (?<msg>.*)\nPassed in:\n(?<actual>.*)\nExpected:\n(?<expected>.*)/)
    let message
    if (diff && diff.groups) {
      message = vscode.TestMessage.diff(diff.groups.msg, diff.groups.expected, diff.groups.actual)
    } else {
      message = new vscode.TestMessage(report.message)
    }

    if (test.uri && report.line) {
      message.location = new vscode.Location(test.uri, new vscode.Position(report.line - 1, 0))
    }
    return message
  }
  return new vscode.TestMessage('Unknown error')
}

/**
 * Takes a report line from a busted test case and parses it to check for the status of that test case.
 * Prints out results as they come from the test case run then returns the result.
 * This result will be TestResult.empty when the report line is not the report for a test's end result.
 * @param line a line of content potentially containing a Report in JSON of the busted output
 * @param run the current test run
 * @param currentTest a test item reference that might not be populated and is populated when a test is identified from the busted report
 * @returns the result of a test case run or empty when the line does not match the test end report
 */
function processItem (
  line: string, run: vscode.TestRun,
  currentTest: vscode.TestItem | undefined
): TestResult {
  let result: TestResult = TestResult.empty
  if (line.startsWith(MAGIC)) {
    const report: TestReport = JSON.parse(line.substring(MAGIC.length + 1))
    const id = rebuildId(report)
    const testName = report.name
    const test = cache.getTest(hashB64String(id))
    Logger.developerLog(`[Busted] Test Detected: ${testName}`)
    Logger.developerLog(`[Busted] Test Id: ${id} | Found: ${test !== undefined}`)

    switch (report.type) {
      case 'testStart': {
        printToResultConsole(run, `[Busted] ▶ Run: ${testName}`)
        if (test) {
          run.started(test)
          currentTest = test
        }
        break
      }
      case 'testEnd': {
        printToResultConsole(run, `[Busted] ⏹ End: ${testName} (${report.status})`)
        currentTest = undefined
        if (test) {
          switch (report.status) {
            case 'success':
              run.passed(test, report.duration)
              result = TestResult.success
              break
            case 'failure':
              run.failed(test, getErrorMessage(test, report), report.duration)
              result = TestResult.error
              break
            case 'pending':
              run.skipped(test)
              result = TestResult.skipped
              break
            case 'error':
              run.errored(test, getErrorMessage(test, report), report.duration)
              result = TestResult.error
              break
          }
        }
        break
      }
      case 'error': {
        result = TestResult.error
        const msg = `[Busted] 💥 error: ${report.message?.replace('/([^\r])\n/g', '$1\r\n') ?? 'Unknown error'}\r\n`
        printToResultConsole(run, msg, undefined, currentTest)
        Logger.error(msg)
        break
      }
      default: {
        result = TestResult.error
        const msg = '[Busted] ⚠ unknown report type:'
        Logger.developerLog(msg, report.type)
        Logger.debug(msg + report.type)
        break
      }
    }
  } else {
    printToResultConsole(run, line, undefined, currentTest)
    Logger.debug(line)
  }
  return result
}

/**
 * Executes busted for all test cases supplied via executable arguments and processes
 * each case individually, parsing the result from the busted run, printing the results
 * and collecting the number of each test case result (success, failure, error or skip).
 * @param resolve The resolve function for signaling a promise result (the busted exit code)
 * @param bustedExecutable the busted executable path
 * @param args the arguments to supply to busted executable
 * @param run the current test run
 * @param token the cancellation token for this test run
 */
function executeBusted (
  resolve: Function,
  bustedExecutable: string,
  args: string[],
  run: vscode.TestRun,
  token: vscode.CancellationToken
) {
  const busted = spawn(bustedExecutable, args, {
    cwd: config.getWorkingDirectory(),
    env: { ...process.env, ...config.getEnvironment() },
    shell: process.platform === 'win32',
    windowsVerbatimArguments: process.platform === 'win32'
  })

  let cntSuccessTests: number = 0
  let cntFailTests: number = 0
  let cntSkipTests: number = 0
  let cntErrorTests: number = 0
  let currentTest: vscode.TestItem | undefined

  // watchdog (from settings)
  const idleMs = vscode.workspace.getConfiguration('busted-test-explorer').get('idleTimeoutMs', 120000)
  withIdleWatchdog(busted, idleMs, run, currentTest)

  const rl = readline.createInterface({ input: busted.stdout })

  rl.on('line', (line: string) => {
    switch (processItem(line, run, currentTest)) {
      case TestResult.success:
        cntSuccessTests++
        break
      case TestResult.failure:
        cntFailTests++
        break
      case TestResult.error:
        cntErrorTests++
        break
      case TestResult.skipped:
        cntSkipTests++
        break
      case TestResult.empty:
        break
    }
  })

  busted.stderr.on('data', data => {
    const s = data.toString()
    printToResultConsole(run, `[Busted] ⚠ stderr: ${s}`, undefined, currentTest)
    Logger.error(`[Busted] 💥 stderr: ${s}`)
  })

  busted.on('error', error => {
    printToResultConsole(run, `[Busted] ⚠ error: ${error.message}`, undefined, currentTest)
    Logger.error(`[Busted] 💥 spawn error: ${error.message}\r\nCheck that '${bustedExecutable}' is installed and in your PATH`)
    vscode.window.showErrorMessage(`[Busted] Failed to spawn busted: (${error.message})`)
  })

  busted.on('close', code => {
    const msg: string = code === 0
      ? '[Busted] ✅ Finished successfully'
      : `[Busted] ❌ Failed with exit code ${code}`
    const statistics: string = `with ${cntSuccessTests} successes, ${cntFailTests} failures, ${cntSkipTests} skipped and ${cntErrorTests} errors`

    printToResultConsole(run, `${msg} ${statistics}`, undefined, currentTest)
    Logger.info(msg)
    Logger.developerLog(`[Busted] close: ${code}`)
    resolve(code ?? 1)
  })

  token.onCancellationRequested(() => {
    busted.kill()
  })
}

/**
 * Execute all tests via busted and collect tests one by one.
 * @param context the extension context
 * @param run the test run
 * @param files the files as uris where there are busted tests
 * @param filter the names of tests to run via filter
 * @param token the cancellation token for the run
 */
export async function execute (
  context: vscode.ExtensionContext,
  run: vscode.TestRun,
  files: Set<vscode.Uri>,
  filter: Set<string>,
  token: vscode.CancellationToken
) {
  // getting profile to determine how to resolve busted executable
  const profile = vscode.workspace.getConfiguration('busted-test-explorer').get<string>('profile', 'local')

  const bustedExecutable = getExecutable(profile)
  const reporterPath = path.join(context.extensionPath, 'res', 'reporter.lua')
  const args = [
    ...[...filter].map(name => `--filter=${quoteIfWindows(escapeLuaPatternMagicCharacters(name))}`), // NEW quoting
    '-o', reporterPath,
    ...config.getArguments(),
    ...[...files].map(uri => uri.fsPath)
  ]

  Logger.developerLog('[Busted] 🔄 Executable:', bustedExecutable, args)
  Logger.info(`[Busted] 🔄 Executable: ${bustedExecutable} \nArgs:\n ${args.join('\n ')}`)

  await new Promise((resolve: Function) => executeBusted(resolve, bustedExecutable, args, run, token))

  run.end()
}
