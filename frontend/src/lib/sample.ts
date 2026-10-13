export const SAMPLE_MARKDOWN = `# Welcome to viewmd

viewmd turns raw **Markdown** into a calm, readable document. Paste notes from an AI chat, a README, or a design doc — then keep them organised in **projects** or as standalone **notes**.

## What renders nicely

- GitHub-flavoured Markdown: tables, task lists, ~~strikethrough~~, footnotes[^1]
- Inline code like \`GET\` and \`INCR\`, plus fenced code with syntax highlighting
- Mermaid diagrams
- An outline of every heading on the right, so long docs stay navigable

### Code

\`\`\`ts
async function incr(key: string) {
  // INCR is atomic: read, increment and write happen as one command
  return redis.incr(key)
}
\`\`\`

\`\`\`
A: GET counter → 0
B: GET counter → 0
A: SET counter 1
B: SET counter 1
\`\`\`

### Diagram

\`\`\`mermaid
flowchart LR
  Paste[Paste Markdown] --> Save[Save] --> Read[Read beautifully]
  Save --> Project[(Project)]
\`\`\`

### Table

| Shortcut | Action |
| --- | --- |
| <kbd>⌘</kbd> <kbd>K</kbd> | Search documents |
| <kbd>⌘</kbd> <kbd>S</kbd> | Save while editing |
| <kbd>E</kbd> | Edit the open document |

## Try it

- [x] Create an account
- [ ] Create a project for related docs
- [ ] Drop a few \`.md\` files onto the project to import them

> Tip: titles come from the first heading automatically, so you rarely need to type one.

[^1]: Like this one.
`
