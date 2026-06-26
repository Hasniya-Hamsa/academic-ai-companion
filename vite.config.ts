import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_REPOSITORY 
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/` 
    : '/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        minify: false
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'screenshot-desktop.png', 'screenshot-mobile.png'],
      manifest: {
        name: 'StudySync AI',
        short_name: 'StudySync',
        description: 'AI-Powered Academic Companion with Timetable, Notes, and NotebookLM Workspace',
        id: '/academic-ai-companion/',
        dir: 'ltr',
        lang: 'en-US',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'tabbed',
        orientation: 'portrait',
        categories: ['education', 'productivity', 'utilities'],
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Academic Timetable',
            short_name: 'Schedule',
            description: 'View and manage your courses schedule',
            url: './',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Study Notes',
            short_name: 'Notes',
            description: 'Open your notebook folders',
            url: './',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          }
        ],
        screenshots: [
          {
            src: 'screenshot-desktop.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'StudySync AI Desktop Dashboard'
          },
          {
            src: 'screenshot-mobile.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'StudySync AI Mobile Notes View'
          }
        ],
        file_handlers: [
          {
            action: './',
            accept: {
              'text/plain': ['.txt', '.text'],
              'text/markdown': ['.md', '.markdown'],
              'application/pdf': ['.pdf']
            }
          }
        ],
        share_target: {
          action: './',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: {
            title: 'share_title',
            text: 'share_text',
            url: 'share_url'
          }
        },
        protocol_handlers: [
          {
            protocol: 'web+studysync',
            url: './?url=%s'
          }
        ],
        display_override: ['tabbed', 'window-controls-overlay', 'standalone'],
        prefer_related_applications: false,
        related_applications: [
          {
            platform: 'play',
            url: 'https://play.google.com/store/apps/details?id=io.github.hasniya_hamsa.academic_ai_companion',
            id: 'io.github.hasniya_hamsa.academic_ai_companion'
          }
        ],
        scope_extensions: [
          {
            origin: 'https://hasniya-hamsa.github.io'
          }
        ],
        iarc_rating_id: 'e8e19bcf-168a-40a2-aa5b-0105342a3f81',
        launch_handler: {
          client_mode: ['focus-existing']
        },
        note_taking: {
          new_note_url: './'
        },
        edge_side_panel: {
          preferred_width: 480
        },
        widgets: [
          {
            name: 'StudySync Summary',
            short_name: 'Summary',
            description: "View today's timetable and stats",
            tag: 'timetable-summary',
            template: 'timetable-widget',
            ms_ac_template: 'widgets/timetable.json',
            data: 'widgets/timetable-data.json',
            type: 'application/json',
            icons: [
              {
                src: 'icon-192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ],
            screenshots: [
              {
                src: 'screenshot-mobile.png',
                sizes: '750x1334',
                type: 'image/png',
                label: 'StudySync Widget'
              }
            ]
          }
        ]
      } as any
    })
  ],
})

