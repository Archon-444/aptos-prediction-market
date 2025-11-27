import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
  },
  // Don't define process.env - Vite handles environment variables via import.meta.env
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React and core dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // Animation libraries
          'vendor-animation': ['framer-motion'],

          // UI utilities
          'vendor-ui': ['react-icons'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
    sourcemap: false, // Disable sourcemaps in production for smaller builds
    commonjsOptions: {
      // Handle eventemitter3 default export
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      '@aptos-labs/wallet-adapter-react',
      '@aptos-labs/wallet-adapter-core',
      '@aptos-labs/ts-sdk',
      'petra-plugin-wallet-adapter',
      '@martianwallet/aptos-wallet-adapter',
    ],
  },
})
