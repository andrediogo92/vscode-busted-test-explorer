export type TestSuiteBlock = 'describe' | 'context' | 'insulate' | 'expose'
export type TestCaseBlock = 'it' | 'spec' | 'pending'
export type TestBlock = TestSuiteBlock | TestCaseBlock

export const testSuiteBlocks: TestSuiteBlock[] = ['describe', 'context', 'insulate', 'expose']
export const testCaseBlocks: TestCaseBlock[] = ['it', 'spec', 'pending']

export enum TestItemType {
  file,
  testSuite,
  testCase
}

export interface TestItemData {
  type: TestItemType;
  name?: string;
}

export type Test = {
  type: TestItemType,
  name: string,
  loc: {
    start: {
      line: number,
      column: number
    },
    end: {
      line: number,
      column: number
    }
  },
  child: Test[]
}

export enum TestResult {
  success,
  failure,
  error,
  skipped,
  empty
}

export type TestReport = {
  type: 'testStart' | 'testEnd' | 'error',
  testSource: string,
  name: string,
  message?: string,
  line?: number,
  duration?: number,
  status: 'success' | 'failure' | 'pending' | 'error'
}
