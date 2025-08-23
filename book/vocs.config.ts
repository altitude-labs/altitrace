import { defineConfig } from 'vocs'
import { sidebar } from './sidebar'

export default defineConfig({
  title: 'Altitrace',
  logoUrl: '/logo.png',
  iconUrl: '/logo.png',
  ogImageUrl: '/altitrace-prod.png',
  sidebar,
  topNav: [
    { text: 'Simulator', link: '/webapp' },
    { text: 'SDK', link: '/sdk/overview' },
    { text: 'GitHub', link: 'https://github.com/altitude-labs/altitrace' },
    {
      text: 'v0.1.0',
      items: [
        {
          text: 'Releases',
          link: 'https://github.com/altitude-labs/altitrace/releases',
        },
        {
          text: 'Contributing',
          link: 'https://github.com/altitude-labs/altitrace/blob/main/CONTRIBUTING.md',
        },
      ],
    },
  ],
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/altitude-labs/altitrace',
    },
    {
      icon: 'telegram',
      link: 'https://t.me/reachaltitude',
    },
  ],
  sponsors: [
    {
      name: 'Collaborators',
      height: 120,
      items: [
        [
          {
            name: 'Altitude Labs',
            link: 'https://x.com/valtitudexyz',
            image: '/altitude.svg',
          },
        ],
      ],
    },
  ],
  theme: {
    accentColor: {
      light: '#1f1f1f',
      dark: '#ffffff',
    },
  },
  editLink: {
    pattern:
      'https://github.com/altitude-labs/altitrace/edit/main/book/docs/pages/:path',
  },
})
