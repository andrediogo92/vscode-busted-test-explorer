# Nu Busted Test Explorer

VSCode Test Explorer integration for Lua tests with **Busted**.

Run Lua Busted test cases in Visual Studio Code.

## Test Explorer Features

- Discover and run Busted tests from VSCode Test Explorer UI.
- Supports filtering, concurrent execution, and detailed output.
- Supports Windows (and WSL) and dockerized runs
- Watchdog to kill hung processes when tests produce no output.

## Profiles

You can run tests in different environments: "local" | "wsl" | "docker" (default: local)

## Overview

A lightweight extension to run Lua Busted test cases in Visual Studio Code.

- Run test cases
- View test report
- View tests in Test Explorer

## Requirements

- VS Code (version 1.138.0 or later)
- [Busted](https://olivinelabs.com/busted/)

## Features

### Run/Debug Test Cases

<p align="center">
  <img src="https://andrediogo92.github.io/vscode-busted-test-explorer/test-run.png" alt="Run Test Cases"/>
</p>

- The extension will generate shortcuts (the green play button) on the left side of the context blocks and test case function calls. To run the target test cases, simply click on the green play button. You can also right click on them to see more options.

---

### Test Explorer

<p align="center">
  <img src="https://andrediogo92.github.io/vscode-busted-test-explorer/test-explorer.png" alt="Test Explorer"/>
</p>

- The Test Explorer is the place to show all the test cases in your workspace. You can also run your test cases from here.

---

### View Test Result

<p align="center">
  <img src="https://andrediogo92.github.io/vscode-busted-test-explorer/test-result.png" alt="View Test Result"/>
</p>

- After running the test cases, the state of the related test items will be updated in both editor decoration and test explorer.
- You can trigger the command `Test: Peek Output` to peek the result view.

## Settings

| Setting Name | Description | Default Value |
| --- | --- | --- |
| `busted-test-explorer.executable` | Name or full path of the busted executable. If only a name is provided, the executable must be in PATH. | `busted` |
| `busted-test-explorer.args` | Additional busted command line option. | `[]` |
| `busted-test-explorer.cwd` | Working directory used by busted during test runs. | `` |
| `busted-test-explorer.env` | Environement variable appended to the environment when busted is executed. | `{}` |
| `busted-test-explorer.testfilepattern` | Test file pattern. | `**/*_spec.lua` |

<p align="center">
  <img src="https://andrediogo92.github.io/vscode-busted-test-explorer/settings.png" alt="VS Code Embedded Settings for Testing"/>
</p>

## Contributing and Feedback

Contributions and feedback are welcomed. Feel free to submit issue and pull request on [the github project](https://github.com/andrediogo92/vscode-busted-test-explorer).

## License

This extension is licensed under [MIT License](LICENSE).
