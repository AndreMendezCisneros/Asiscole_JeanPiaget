import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { writeFileSync } from "fs";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";
import { cspConnectSrcPlugin } from "./vite-plugin-csp-connect";

function resolveBuildId(): string {
  if (process.env.VITE_BUILD_ID) return process.env.VITE_BUILD_ID;
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

function buildVersionPlugin() {
  return {
    name: "sie-build-version",
    apply: "build" as const,
    closeBundle() {
      const version = resolveBuildId();
      writeFileSync(
        path.resolve(__dirname, "dist/build-version.json"),
        JSON.stringify({ version, builtAt: new Date().toISOString() }),
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildId = resolveBuildId();

  return {
  base: "/",
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/sc-proxy": {
        target: "http://localhost:2785",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sc-proxy/, "/api"),
      },
    },
  },
  plugins: [react(), cspConnectSrcPlugin(), buildVersionPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Tablets Android antiguas del colegio (WebView ~Chrome 63+)
    target: ['es2018', 'chrome63', 'safari12', 'ios12'],
    modulePreload: {
      resolveDependencies(_filename, deps) {
        // No precargar librerías de reportes en la primera pantalla.
        // spring-vendor sí se precarga porque LoadingScreen lo necesita desde el arranque.
        return deps.filter(
          (dep) =>
            !dep.includes('report-excel') &&
            !dep.includes('report-pdf') &&
            !dep.includes('spring-vendor') &&
            !dep.includes('gsap-vendor')
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            if (id.includes('/src/pages/')) {
              const publicOnly =
                id.includes('/Login') ||
                id.includes('/TutorScanner') ||
                id.includes('/ParentPortal') ||
                id.includes('/ParentDniPortal') ||
                id.includes('/ArrivalView') ||
                id.includes('/ChangePassword') ||
                id.includes('/NotFound');
              if (!publicOnly) return 'staff-app';
            }
            return;
          }

          // Reportes: sólo se cargan al generar Excel/PDF
          if (id.includes('/exceljs/')) return 'report-excel';
          if (id.includes('/jspdf')) return 'report-pdf';

          // No aislar recharts: rompe init order (TDZ). Supabase SÍ es seguro separar.
          if (id.includes('/@supabase/')) return 'supabase-vendor';

          // GSAP: animaciones del portal de padres/login
          if (id.includes('/gsap/') || id.includes('/@gsap/')) return 'gsap-vendor';

          if (id.includes('/@react-spring/')) return 'spring-vendor';

          // React core
          if (
            id.includes('/react-dom/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/react-router/') ||
            /\/node_modules\/react\//.test(id)
          ) {
            return 'react-vendor';
          }

          // TanStack Query
          if (id.includes('/@tanstack/')) return 'query-vendor';

          // Radix UI / shadcn
          if (id.includes('/@radix-ui/')) return 'ui-vendor';

          // date-fns + zod
          if (id.includes('/date-fns/') || id.includes('/zod/')) return 'utils-vendor';
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: mode === 'development',
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'gsap',
      '@gsap/react',
      '@tanstack/react-query',
    ],
  },
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
};
});
