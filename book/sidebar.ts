import type { Sidebar } from 'vocs'

export const sidebar: Sidebar = [
  {
    text: 'Introduction',
    items: [
      { text: 'What is Altitrace?', link: '/introduction' },
      { text: 'Why Altitrace?', link: '/introduction/why-altitrace' },
    ],
  },
  {
    text: 'Installation',
    link: '/installation',
  },
  {
    text: 'API Reference',
    items: [
      { text: 'Overview', link: '/api' },
      { text: 'Authentication', link: '/api/authentication' },
      { text: 'Simulation Endpoints', link: '/api/simulation' },
      { text: 'Transaction Endpoints', link: '/api/transactions' },
    ],
  },
  {
    text: 'SDK Documentation',
    items: [
      { text: 'Getting Started', link: '/sdk' },
      { text: 'Installation', link: '/sdk/installation' },
      { text: 'Client Setup', link: '/sdk/client-setup' },
      { text: 'Simulation Methods', link: '/sdk/simulation' },
      { text: 'Transaction Building', link: '/sdk/transactions' },
      { text: 'Trace Analysis', link: '/sdk/traces' },
    ],
  },
  {
    text: 'Web Application',
    items: [
      { text: 'Overview', link: '/webapp' },
      { text: 'Using the Interface', link: '/webapp/interface' },
      { text: 'Transaction Simulation', link: '/webapp/simulation' },
      { text: 'Debugging Tools', link: '/webapp/debugging' },
      { text: 'Export & Analysis', link: '/webapp/export' },
    ],
  },
]
