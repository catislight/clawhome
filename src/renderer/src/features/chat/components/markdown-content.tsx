import clsx from 'clsx'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import bashLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/bash.js'
import cppLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/cpp.js'
import cssLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/css.js'
import goLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/go.js'
import javaLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/java.js'
import javascriptLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/javascript.js'
import jsonLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/json.js'
import jsxLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/jsx.js'
import markdownLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/markdown.js'
import markupLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/markup.js'
import pythonLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/python.js'
import rustLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/rust.js'
import sqlLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/sql.js'
import tsxLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/tsx.js'
import typescriptLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/typescript.js'
import yamlLanguage from 'react-syntax-highlighter/dist/esm/languages/prism/yaml.js'
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus.js'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Children, isValidElement, type ReactNode } from 'react'

import { rehypeAnimateStreamingText } from '@/features/chat/lib/rehype-animate-streaming-text'

interface MarkdownContentProps {
  content: string
  className?: string
  optimistic?: boolean
  highlightCode?: boolean
  animateCharacters?: boolean
}

type MarkdownCodeBlockProps = {
  code: string
  language?: string
  highlightCode: boolean
  deferHighlight: boolean
}

type CodeElementProps = {
  children?: ReactNode
  className?: string
}

const CODE_LANGUAGE_ALIASES: Record<string, string> = {
  bash: 'bash',
  'c++': 'cpp',
  cpp: 'cpp',
  css: 'css',
  go: 'go',
  html: 'markup',
  javascript: 'javascript',
  js: 'javascript',
  java: 'java',
  json: 'json',
  json5: 'json',
  jsonc: 'json',
  jsx: 'jsx',
  markdown: 'markdown',
  md: 'markdown',
  py: 'python',
  python: 'python',
  rust: 'rust',
  shell: 'bash',
  shellscript: 'bash',
  sh: 'bash',
  sql: 'sql',
  ts: 'typescript',
  tsx: 'tsx',
  typescript: 'typescript',
  xml: 'markup',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash'
}

SyntaxHighlighter.registerLanguage('bash', bashLanguage)
SyntaxHighlighter.registerLanguage('cpp', cppLanguage)
SyntaxHighlighter.registerLanguage('css', cssLanguage)
SyntaxHighlighter.registerLanguage('go', goLanguage)
SyntaxHighlighter.registerLanguage('java', javaLanguage)
SyntaxHighlighter.registerLanguage('javascript', javascriptLanguage)
SyntaxHighlighter.registerLanguage('json', jsonLanguage)
SyntaxHighlighter.registerLanguage('jsx', jsxLanguage)
SyntaxHighlighter.registerLanguage('markdown', markdownLanguage)
SyntaxHighlighter.registerLanguage('markup', markupLanguage)
SyntaxHighlighter.registerLanguage('python', pythonLanguage)
SyntaxHighlighter.registerLanguage('rust', rustLanguage)
SyntaxHighlighter.registerLanguage('sql', sqlLanguage)
SyntaxHighlighter.registerLanguage('tsx', tsxLanguage)
SyntaxHighlighter.registerLanguage('typescript', typescriptLanguage)
SyntaxHighlighter.registerLanguage('yaml', yamlLanguage)

function inferLanguageFromContext(line: string): string | null {
  const match = line.match(
    /\b(python|py|javascript|js|typescript|ts|bash|shell|sql|html|css|json|yaml|yml|cpp|c\+\+|java|go|rust)\b/i
  )
  if (!match) {
    return null
  }

  const language = match[1].toLowerCase()
  if (language === 'py') return 'python'
  if (language === 'js') return 'javascript'
  if (language === 'ts') return 'typescript'
  if (language === 'shell') return 'bash'
  if (language === 'yml') return 'yaml'
  if (language === 'cpp') return 'c++'
  return language
}

function isLikelyCodeContextLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) {
    return false
  }

  return /[:：]\s*$/.test(trimmed)
}

function isLikelyCodeLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) {
    return false
  }

  return (
    /^(def |class |if |elif |else:|for |while |try:|except |finally:|return\b|yield\b|import\b|from\b)/.test(
      trimmed
    ) ||
    /^(const |let |var |function |async function |export |import |interface |type |class )/.test(
      trimmed
    ) ||
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(trimmed) ||
    /^(<[^>]+>|\{|\}|\]|\[|#include\b|package\b|public |private |protected )/.test(trimmed) ||
    /[:=()[\]{}<>]/.test(trimmed)
  )
}

function normalizeLikelyCodeBlocks(markdown: string): string {
  const lines = markdown.split('\n')
  const normalizedLines: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (/^```/.test(trimmed)) {
      normalizedLines.push(line)
      continue
    }

    const inferredLanguage = inferLanguageFromContext(trimmed)
    const nextLine = lines[index + 1] ?? ''
    const nextTrimmed = nextLine.trim()

    if (!inferredLanguage || !isLikelyCodeContextLine(trimmed) || nextTrimmed) {
      normalizedLines.push(line)
      continue
    }

    let runEnd = index + 2
    let nonEmptyCodeLines = 0

    while (runEnd < lines.length) {
      const candidate = lines[runEnd]
      const candidateTrimmed = candidate.trim()

      if (!candidateTrimmed) {
        runEnd += 1
        continue
      }

      if (!isLikelyCodeLine(candidate)) {
        break
      }

      nonEmptyCodeLines += 1
      runEnd += 1
    }

    if (nonEmptyCodeLines < 2) {
      normalizedLines.push(line)
      continue
    }

    normalizedLines.push(line)
    normalizedLines.push('')
    normalizedLines.push(`\`\`\`${inferredLanguage}`)
    normalizedLines.push(...lines.slice(index + 2, runEnd))
    normalizedLines.push('```')
    index = runEnd - 1
  }

  return normalizedLines.join('\n')
}

function normalizeMarkdownForStreaming(
  markdown: string,
  optimistic: boolean
): {
  markdown: string
  hasUnclosedFence: boolean
} {
  const normalized = normalizeLikelyCodeBlocks(markdown.replace(/\r\n/g, '\n'))
  if (!optimistic) {
    return {
      markdown: normalized,
      hasUnclosedFence: false
    }
  }

  const lines = normalized.split('\n')
  let hasOpenFence = false

  for (const line of lines) {
    if (/^```([a-zA-Z0-9_+.#-]*)\s*$/.test(line.trim())) {
      hasOpenFence = !hasOpenFence
    }
  }

  return {
    markdown: hasOpenFence ? `${normalized}\n\`\`\`` : normalized,
    hasUnclosedFence: hasOpenFence
  }
}

function extractTextContent(value: ReactNode): string {
  return Children.toArray(value)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child)
      }

      if (isValidElement(child)) {
        const nestedChildren: ReactNode =
          typeof child.props === 'object' && child.props !== null && 'children' in child.props
            ? (child.props.children as ReactNode)
            : null

        return extractTextContent(nestedChildren)
      }

      return ''
    })
    .join('')
}

function inferLanguageFromCode(code: string): string | undefined {
  const text = code.trim()
  if (!text) {
    return undefined
  }

  if (/^\s*[{[][\s\S]*[}\]]\s*$/.test(text)) {
    try {
      JSON.parse(text)
      return 'json'
    } catch {
      // ignore
    }
  }

  if (/^\s*(from\s+\w+\s+import|import\s+\w+|def\s+\w+\s*\(|class\s+\w+\s*[:(])/m.test(text)) {
    return 'python'
  }

  if (
    /^\s*(const|let|var)\s+\w+|^\s*function\s+\w+\s*\(|^\s*import\s+.+\s+from\s+['"]|^\s*export\s+/m.test(
      text
    )
  ) {
    return 'javascript'
  }

  if (/^\s*#!/.test(text) || /^\s*(echo|cd|ls|cat|grep|curl|wget)\b/m.test(text)) {
    return 'bash'
  }

  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b[\s\S]*$/im.test(text)) {
    return 'sql'
  }

  if (/^\s*<([a-zA-Z][\w:-]*)(\s|>)/m.test(text)) {
    return 'markup'
  }

  if (/^\s*[\w.-]+\s*:\s*.+/m.test(text) && !/[{};]/.test(text)) {
    return 'yaml'
  }

  return undefined
}

function resolveCodeLanguage(language?: string, code?: string): string | undefined {
  const normalizedLanguage = language?.trim().toLowerCase().replace(/^language-/, '')

  if (normalizedLanguage) {
    return CODE_LANGUAGE_ALIASES[normalizedLanguage] ?? normalizedLanguage
  }

  return inferLanguageFromCode(code ?? '')
}

function MarkdownCodeBlock({
  code,
  language,
  highlightCode,
  deferHighlight
}: MarkdownCodeBlockProps): React.JSX.Element {
  const resolvedLanguage = resolveCodeLanguage(language, code)

  if (highlightCode && !deferHighlight) {
    return (
      <div className="markdown-code-block">
        <SyntaxHighlighter
          PreTag="pre"
          className="markdown-syntax-highlighter"
          codeTagProps={{
            className: resolvedLanguage ? `language-${resolvedLanguage}` : undefined
          }}
          customStyle={{
            margin: 0,
            borderRadius: '0.85rem',
            padding: '0.95rem 1rem'
          }}
          language={resolvedLanguage}
          style={vscDarkPlus}
          wrapLongLines={false}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    )
  }

  return (
    <div className="markdown-code-block">
      <pre className="markdown-plain-code">
        <code className={language ? `language-${language}` : undefined}>{code}</code>
      </pre>
    </div>
  )
}

export function MarkdownContent({
  content,
  className,
  optimistic = false,
  highlightCode = true,
  animateCharacters = false
}: MarkdownContentProps): React.JSX.Element {
  const normalized = normalizeMarkdownForStreaming(content, optimistic)
  const deferHighlight = optimistic && normalized.hasUnclosedFence

  const components: Components = {
    a: ({ className: linkClassName, ...props }) => (
      <a
        {...props}
        className={clsx('transition-colors hover:text-[#0057AD]', linkClassName)}
        rel="noopener noreferrer"
        target="_blank"
      />
    ),
    p: ({ node: markdownNode, className: paragraphClassName, ...props }) => {
      void markdownNode

      return <p {...props} className={clsx('whitespace-pre-line', paragraphClassName)} />
    },
    code: ({ className: codeClassName, children, ...props }) => (
      <code {...props} className={codeClassName}>
        {children}
      </code>
    ),
    pre: ({ children }) => {
      const firstChild = Children.toArray(children)[0]

      if (!isValidElement<CodeElementProps>(firstChild)) {
        return <pre>{children}</pre>
      }

      const code = extractTextContent(firstChild.props.children).replace(/\n$/, '')
      const className =
        typeof firstChild.props.className === 'string' ? firstChild.props.className : ''
      const language = className.match(/language-([^\s]+)/)?.[1]

      return (
        <MarkdownCodeBlock
          code={code}
          language={language}
          highlightCode={highlightCode}
          deferHighlight={deferHighlight}
        />
      )
    }
  }

  return (
    <div className={clsx('markdown-content', className)}>
      <ReactMarkdown
        components={components}
        rehypePlugins={animateCharacters ? [rehypeAnimateStreamingText] : undefined}
        remarkPlugins={[remarkGfm]}
        urlTransform={defaultUrlTransform}
      >
        {normalized.markdown}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownContent
