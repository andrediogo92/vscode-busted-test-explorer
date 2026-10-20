import { workspace } from 'vscode'
import { expandString } from './expand'
import { ExecutableProfile, ParserLuaVersion } from './types'

const section = 'busted-test-explorer'

enum ConfigKey {
  localExecutable = 'localExecutable',
  wslExecutable = 'wslExecutable',
  dockerExecutable = 'dockerExecutable',
  testFilePattern = 'testFilePattern',
  luaVersion = 'luaVersion',
  profile = 'profile',
  args = 'args',
  cwd = 'cwd',
  env = 'env'
}

const defaultValues: { [id: string] : any } = {}

Object.keys(ConfigKey).forEach(key => {
  defaultValues[key] = workspace.getConfiguration(section).inspect(key)?.defaultValue
})

function getValue<T> (key: ConfigKey): T {
  let value = workspace.getConfiguration(section).get<T>(key, defaultValues[ConfigKey[key]])
  if (typeof value === 'string') {
    value = <any>expandString<T>(value)
  } else if (Array.isArray(value)) {
    value = <any>value.map(v => expandString<T>(v))
  } else if (typeof value === 'object') {
    const o: { [id: string] : string } = <any>value
    Object.keys(o).forEach(k => {
      o[k] = <string>expandString<T>(o[k])
    })
  }

  return value
}

export function getWSLExecutable (): string {
  return getValue<string>(ConfigKey.wslExecutable)
}

export function getDockerExecutable (): string {
  return getValue<string>(ConfigKey.dockerExecutable)
}

export function getLocalExecutable (): string {
  return getValue<string>(ConfigKey.localExecutable)
}

export function getProfile (): ExecutableProfile {
  let profile = ExecutableProfile.local
  switch (getValue<string>(ConfigKey.profile)) {
    case 'wsl':
      profile = ExecutableProfile.wsl
      break
    case 'docker':
      profile = ExecutableProfile.docker
      break
  }
  return profile
}

export function getLuaVersion (): ParserLuaVersion {
  return getValue<ParserLuaVersion>(ConfigKey.luaVersion)
}

export function getFilePattern (): string {
  return getValue<string>(ConfigKey.testFilePattern)
}

export function getArguments (): string[] {
  return getValue<string[]>(ConfigKey.args)
}

export function getWorkingDirectory (): string | undefined {
  return getValue<string>(ConfigKey.cwd)
}

export function getEnvironment (): { [id: string] : string } {
  return getValue<{ [id: string] : string }>(ConfigKey.env)
}
