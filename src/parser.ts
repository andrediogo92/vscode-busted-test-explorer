import * as luaparse from 'luaparse'
import * as config from './config'
import { Test, TestBlock, TestCaseBlock, testCaseBlocks, TestItemType, TestSuiteBlock, testSuiteBlocks } from './types'
import { unescapeSlashes } from './utils'

/**
 * @param expression the expression to check
 * @returns whether the expression is one of the test blocks
 */
function isTestBlock (expression: string): expression is TestBlock {
  return isTestCaseBlock(expression) || isTestSuiteBlock(expression)
}

/**
 * @param expression the expression to check
 * @returns whether the expression is one of the test case blocks
 */
function isTestCaseBlock (expression: string): expression is TestCaseBlock {
  return (testCaseBlocks as readonly string[]).includes(expression)
}

/**
 * @param expression the expression to check
 * @returns whether the expression is one of the test suite blocks
 */
function isTestSuiteBlock (expression: string): expression is TestSuiteBlock {
  return (testSuiteBlocks as readonly string[]).includes(expression)
}

function isCallStatement (node: luaparse.Statement): node is luaparse.CallStatement {
  return node.type === 'CallStatement'
}

function isCallExpression (expression: luaparse.CallExpression | luaparse.StringCallExpression | luaparse.TableCallExpression): expression is luaparse.CallExpression {
  return expression?.type === 'CallExpression'
}

function isIdentifier (base: luaparse.Expression): base is luaparse.Identifier {
  return base.type === 'Identifier'
}

/**
 * Checks the block is a test suite block or a regular test case or throws an error
 * @param blockName
 * @returns whether the block is a test suite block, or a test case
 */
function getType (blockName: TestBlock): TestItemType {
  let result: TestItemType
  if (isTestSuiteBlock(blockName)) {
    result = TestItemType.testSuite
  } else if (isTestCaseBlock(blockName)) {
    result = TestItemType.testCase
  } else {
    throw new Error('Unexpected block name: ' + blockName)
  }
  return result
}

function parseNode (currentBlock: Test, node: luaparse.Statement) {
  if (!isCallStatement(node)) {
    return
  }
  if (!isCallExpression(node.expression)) {
    return
  }
  if (!isIdentifier(node.expression.base)) {
    return
  }
  if (!isTestBlock(node.expression.base.name)) {
    return
  }

  const type = getType(node.expression.base.name)
  let name = ''
  if (node.expression.arguments[0]?.type === 'StringLiteral') {
    const raw = node.expression.arguments[0].raw
    name = unescapeSlashes(raw.substring(1, raw.length - 1))
  }

  const test = {
    type,
    name,
    loc: <Test['loc']>node.expression.loc,
    child: []
  }

  currentBlock.child.push(test)

  if (type === TestItemType.testSuite) {
    let body: luaparse.Statement[] | undefined
    if (node.expression.arguments[0].type === 'FunctionDeclaration') {
      body = node.expression.arguments[0].body
    } else if (node.expression.arguments[1].type === 'FunctionDeclaration') {
      body = node.expression.arguments[1].body
    }
    if (body) {
      body.forEach((node: luaparse.Statement) => {
        parseNode(test, node)
      })
    }
  }
}

export function parse (code: string): Test[] {
  const tests = {
    type: TestItemType.file,
    name: '',
    loc: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
    child: []
  }

  const ast = luaparse.parse(code.toString(), {
    luaVersion: config.getLuaVersion(),
    comments: false,
    locations: true
  })

  if (ast.type === 'Chunk' && ast.body instanceof Array) {
    ast.body.forEach((node: luaparse.Statement) => {
      parseNode(tests, node)
    })
  }

  return tests.child
}
