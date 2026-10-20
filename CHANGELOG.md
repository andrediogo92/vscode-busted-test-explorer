# Change Log

## [0.2.7]

### Extension

- Handles filesystem watcher lifecycles correctly with disposal. Attempts to better capture file deletion.

### Runner

- Properly grabs configuration keys via config's typesafe functions.

### Config

- Refactors configuration variables and their usage to be more consistent.
- Now handles local, docker, wsl configurations within the config map
- Introduces a lua version configuration key for the parser (Lua 5.3, 5.2 and 5.1 are not compatible and some additions, like bitwise operations crash a parser expecting Lua 5.1). Parser now defaults to Lua 5.3.

### Reporter

- Error handler captures element if parent is nil (which can happen for top-level errors) instead of crashing.

## [0.2.6]

Major refactors to extension, parser and runner. Minor refactors for the lua busted reporter sidecar and exported types.

### Extension

- All paths are normalized and taken via Uri's fsPath to ensure easier consistency with reported paths from busted
- Uri's are now preserved until they need to be resolved to string.
- Each function that transforms the test run is now extracted to remove implicit context absorbed via closure.
- Test include and excludes now properly affect the final filter arguments and in correct order (first includes are resolved than excludes are removed from includes).
- All test ids are now hashed and compacted using Base64 encoding over an XXHash3 hash of file uri + test name.
- All code is now annotated and documented.

### Runner

- Summary reports now specify how many tests were successful, failed, skipped and errored.
- Filter arguments passed to busted are now properly treated as lua patterns and escaped.
- Extracts functions responsible for collecting busted test execution reports and processing each test execution report.
- Busted reports collected from the reporter sidecar are now properly typed.
- All functions are properly annotated and documented.

### Parser

- All types from luaparse are now explicitly typed within parser.
- Types are narrowed and used with type guard functions to ensure better compiler support for proper typing and safety.

### Types

- Narrows string types which are just unions of literals
- Adds all variants for test suites and test cases.
- Adds test result type.

### Reporter

- Isolates the test source file (path) and the test name within the reports.

## [0.2.5] - 2025-09-17

### Added

- **Profile support** for running Busted:
  - `local` (default, runs on host system)
  - `wsl` (runs inside Windows Subsystem for Linux)
  - `docker` (runs inside Docker container)
- New configuration options:
  - `busted-test-explorer.profile`
  - `busted-test-explorer.executable`
  - `busted-test-explorer.wslExecutable`
  - `busted-test-explorer.dockerExecutable`
  - `busted-test-explorer.args`

### Changed

- Runner now respects selected profile and executable.
- Improved **watchdog**: detects idle processes (no output for N seconds) and terminates them with error.
- More detailed **logging** in Output panel with emojis for readability.
- Enhanced **error reporting**:
  - Displays stderr and watchdog timeout in Test Explorer.

### Fixed

- Hanging processes no longer block Test Explorer (watchdog kill).
- Duplicate controller ID error removed (activation refactor).

## [0.2.2]

- Fix issue where tests removed from file stay forever in explorer view

## [0.2.1]

- Fix path issue on Windows
- Display an error message when we failed to spawn busted

## [0.2.0]

- Substitute variable in extension settings

## [0.1.1]

- Add extension icon

## [0.1.0]

- Initial release
