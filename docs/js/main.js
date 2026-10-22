const PAGE_TITLE = document.title
const SIGNATURE = /^[a-zA-Z]+\(.*\)$/
const BACKTICKS = /`/g
const TABLE_PIPES = /\s*\|\s*/g

const HELPERS_LABEL = 'Helpers'

const sidebarLabel = signature =>
  signature.includes('), ')
    ? HELPERS_LABEL
    : `${signature.slice(0, signature.indexOf('('))}()`

const markSignatures = () => {
  document.querySelectorAll('.markdown-section h3').forEach(heading => {
    if (SIGNATURE.test(heading.textContent.trim())) { heading.classList.add('signature') }
  })

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    const text = link.textContent.trim()
    if (!SIGNATURE.test(text)) return
    const label = sidebarLabel(text)
    link.textContent = label
    if (label !== HELPERS_LABEL) link.classList.add('signature')
  })
}

const replaceInTextNodes = (element, transform) => {
  const walker = document.createTreeWalker(element, window.NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    walker.currentNode.nodeValue = transform(walker.currentNode.nodeValue)
  }
}

const cleanTitle = text => text.replace(BACKTICKS, '')
const cleanSnippet = text => cleanTitle(text).replace(TABLE_PIPES, ' ')

const cleanSearchResults = panel => {
  panel
    .querySelectorAll('.matching-post .title')
    .forEach(title => replaceInTextNodes(title, cleanTitle))
  panel
    .querySelectorAll('.matching-post .content')
    .forEach(snippet => replaceInTextNodes(snippet, cleanSnippet))
}

const watchSearchResults = () => {
  const panel = document.querySelector('.search .results-panel')
  if (!panel) return
  new window.MutationObserver(() => cleanSearchResults(panel)).observe(panel, {
    childList: true
  })
}

const enhancePage = () => {
  document.querySelector('#seo-content')?.remove()
  markSignatures()
  window.codecopy('pre')
}

window.$docsify = {
  name: 'onesecret',
  repo: 'kikobeats/onesecret',
  maxLevel: 3,
  auto2top: true,
  noEmoji: true,
  externalLinkRel: 'noopener noreferrer',
  pageTitleFormatter: () => PAGE_TITLE,
  search: {
    placeholder: 'Search',
    noData: 'No results',
    depth: 3
  },
  plugins: [
    hook => {
      hook.doneEach(enhancePage)
      hook.ready(watchSearchResults)
    }
  ]
}
