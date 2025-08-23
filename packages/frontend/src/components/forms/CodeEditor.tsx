'use client'

import Editor from '@monaco-editor/react'
import { useState } from 'react'
import { Button } from '@/components/ui'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language?: 'solidity' | 'json'
  readOnly?: boolean
  height?: string
  className?: string
  onCompile?: () => void
  isCompiling?: boolean
  hasErrors?: boolean
}

export function CodeEditor({
  value,
  onChange,
  language = 'solidity',
  readOnly = false,
  height = '400px',
  className = '',
  onCompile,
  isCompiling = false,
  hasErrors = false,
}: CodeEditorProps) {
  const [isEditorReady, setIsEditorReady] = useState(false)

  const handleEditorDidMount = (editor: any, monaco: any) => {
    setIsEditorReady(true)

    // Configure Solidity language support
    if (language === 'solidity') {
      monaco.languages.register({ id: 'solidity' })

      // Basic Solidity syntax highlighting
      monaco.languages.setMonarchTokensProvider('solidity', {
        defaultToken: '',
        tokenPostfix: '.sol',

        keywords: [
          'pragma',
          'contract',
          'interface',
          'library',
          'function',
          'modifier',
          'event',
          'struct',
          'enum',
          'mapping',
          'address',
          'uint256',
          'uint128',
          'uint64',
          'uint32',
          'uint16',
          'uint8',
          'int256',
          'int128',
          'int64',
          'int32',
          'int16',
          'int8',
          'bool',
          'string',
          'bytes',
          'bytes32',
          'bytes16',
          'bytes8',
          'bytes4',
          'bytes2',
          'bytes1',
          'public',
          'private',
          'internal',
          'external',
          'pure',
          'view',
          'payable',
          'memory',
          'storage',
          'calldata',
          'constant',
          'immutable',
          'virtual',
          'override',
          'abstract',
          'constructor',
          'fallback',
          'receive',
          'import',
          'using',
          'for',
          'is',
          'if',
          'else',
          'while',
          'for',
          'do',
          'break',
          'continue',
          'return',
          'try',
          'catch',
          'throw',
          'emit',
          'require',
          'assert',
          'revert',
        ],

        typeKeywords: [
          'address',
          'bool',
          'string',
          'bytes',
          'uint',
          'int',
          'mapping',
        ],

        operators: [
          '=',
          '>',
          '<',
          '!',
          '~',
          '?',
          ':',
          '==',
          '<=',
          '>=',
          '!=',
          '&&',
          '||',
          '++',
          '--',
          '+',
          '-',
          '*',
          '/',
          '&',
          '|',
          '^',
          '%',
          '<<',
          '>>',
          '>>>',
          '+=',
          '-=',
          '*=',
          '/=',
          '&=',
          '|=',
          '^=',
          '%=',
          '<<=',
        ],

        symbols: /[=><!~?:&|+\-*/^%]+/,

        tokenizer: {
          root: [
            [
              /[a-zA-Z_$][\w$]*/,
              {
                cases: {
                  '@typeKeywords': 'keyword',
                  '@keywords': 'keyword',
                  '@default': 'identifier',
                },
              },
            ],

            [/[{}()[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [
              /@symbols/,
              {
                cases: {
                  '@operators': 'operator',
                  '@default': '',
                },
              },
            ],

            [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
            [/0[xX][0-9a-fA-F]+/, 'number.hex'],
            [/\d+/, 'number'],

            [/[;,.]/, 'delimiter'],

            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

            [/'[^\\']'/, 'string'],
            [/'/, 'string.invalid'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment'],
          ],

          comment: [
            [/[^/*]+/, 'comment'],
            [/\/\*/, 'comment', '@push'],
            ['\\*/', 'comment', '@pop'],
            [/[/*]/, 'comment'],
          ],

          string: [
            [/[^\\"]+/, 'string'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
          ],
        },
      })
    }

    // Editor configuration
    editor.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontSize: 14,
      lineNumbers: 'on',
      folding: true,
      wordWrap: 'on',
    })
  }

  return (
    <div className={`relative border rounded-lg overflow-hidden ${className}`}>
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            {language === 'solidity' ? 'Solidity' : 'JSON'}
          </span>
          {hasErrors && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded">
              Errors
            </span>
          )}
          {!readOnly && (
            <span className="text-xs text-muted-foreground">
              • Ctrl+S to format
            </span>
          )}
        </div>

        {onCompile && (
          <Button
            size="sm"
            onClick={onCompile}
            disabled={isCompiling || !isEditorReady}
            loading={isCompiling}
            className="h-6"
          >
            {isCompiling ? 'Compiling...' : 'Compile'}
          </Button>
        )}
      </div>

      {/* Monaco Editor */}
      <div style={{ height }}>
        <Editor
          value={value}
          onChange={(newValue) => onChange(newValue || '')}
          language={language === 'solidity' ? 'solidity' : 'json'}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: 'on',
            folding: true,
            wordWrap: 'on',
            contextmenu: !readOnly,
            quickSuggestions: !readOnly,
            suggestOnTriggerCharacters: !readOnly,
            acceptSuggestionOnEnter: !readOnly ? 'on' : 'off',
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Loading editor...
                </p>
              </div>
            </div>
          }
        />
      </div>
    </div>
  )
}
