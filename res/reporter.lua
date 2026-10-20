local json = require ("dkjson")

local MAGIC = '[VSCODE-BUSTED-REPORT]'

return function(options)
  local busted = require("busted")
  local handler = require("busted.outputHandlers.base")()

  local currentFile = nil
  local lastFailure = nil

  local function report(entry)
    print(MAGIC, json.encode(entry))
  end

  local function get_test_id(element)
    if element and element.trace then
      return element.trace.source:sub(2), handler.getFullName(element)
    end
  end

  handler.testStart = function(element, parent)
    local testSource, name = get_test_id(element)
    report({
      type = "testStart",
      testSource = testSource,
      name = name
    })
  end

  handler.testEnd = function(element, parent, status, trace)
    local testSource, name = get_test_id(element)
    local entry = {
      type = "testEnd",
      testSource = testSource,
      name = name,
      duration = element.duration*1000,
      status = status
    }

    if (status == "failure" or status == "error") and
        lastFailure and
        lastFailure.testSource == testSource and
        lastFailure.name == name
    then
      entry.message = lastFailure.message
      entry.line = lastFailure.line
    end

    report(entry)
  end

  handler.failureTest = function(element, parent, message, trace)
    local testSource, name = get_test_id(element)
    lastFailure = {
      testSource = testSource,
      name = name,
      message = message,
      line = trace.currentline
    }
  end

  handler.error = function(element, parent, message, trace)
    local testSource, name = get_test_id(element)
    if element.descriptor ~= "describe" then
      element = parent or element
    end
    report({
      type = "error",
      testSource = testSource or '',
      name = name or element.name,
      message = type(trace.message) == "table" and trace.message.message or trace.message,
      line = trace.currentline
    })
  end

  handler.fileStart = function(file)
    currentFile = file
  end

  handler.fileEnd = function(file)
    currentFile = nil
  end

  busted.subscribe({'test', 'start'}, handler.testStart)
  busted.subscribe({'test', 'end'}, handler.testEnd)

  busted.subscribe({ 'error', 'it' }, handler.failureTest)
  busted.subscribe({ 'failure', 'it' }, handler.failureTest)
  busted.subscribe({ 'error' }, handler.error)
  busted.subscribe({ 'failure' }, handler.error)

  busted.subscribe({ 'file', 'start' }, handler.fileStart)
  busted.subscribe({ 'file', 'end' }, handler.fileEnd)

  return handler
end
