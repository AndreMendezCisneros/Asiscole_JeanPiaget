import type { Config } from "tailwindcss";
import { COLORS } from "./src/lib/constants/colors";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Colores base
        primary: {
          DEFAULT: COLORS.primary,
          light: COLORS.primaryLight,
          dark: COLORS.primaryDark,
          foreground: COLORS.textOnPrimary,
        },
        secondary: {
          DEFAULT: COLORS.secondary,
          light: COLORS.secondaryLight,
          dark: COLORS.secondaryDark,
          foreground: COLORS.textOnSecondary,
        },
        accent: {
          DEFAULT: COLORS.accent,
          light: COLORS.accentLight,
          dark: COLORS.accentDark,
          foreground: COLORS.textOnAccent,
        },
        
        // Estados y utilidades
        success: {
          DEFAULT: COLORS.success,
          foreground: COLORS.white,
        },
        warning: {
          DEFAULT: COLORS.warning,
          foreground: COLORS.white,
        },
        error: {
          DEFAULT: COLORS.error,
          foreground: COLORS.white,
        },
        info: {
          DEFAULT: COLORS.info,
          foreground: COLORS.white,
        },
        background: {
          DEFAULT: COLORS.background,
          alt: COLORS.backgroundAlt,
          warm: COLORS.backgroundWarm,
        },
        foreground: COLORS.textPrimary,
        card: {
          DEFAULT: COLORS.paper,
          alt: COLORS.paperAlt,
          foreground: COLORS.textPrimary,
        },
        
        // Tonos complementarios
        cream: COLORS.cream,
        beige: COLORS.beige,
        sand: COLORS.sand,
        'warm-gray': COLORS.warmGray,
        
        // Componentes
        input: {
          DEFAULT: COLORS.white,
          border: COLORS.borderMedium,
          ring: COLORS.primary,
          foreground: COLORS.textPrimary,
        },
        
        // Barra lateral (variables CSS para opacidad y tema)
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
          primary: 'hsl(var(--sidebar-primary) / <alpha-value>)',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground) / <alpha-value>)',
          accent: 'hsl(var(--sidebar-accent) / <alpha-value>)',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground) / <alpha-value>)',
          border: 'hsl(var(--sidebar-border) / <alpha-value>)',
          ring: 'hsl(var(--sidebar-ring) / <alpha-value>)',
        },
        
        // Bordes y divisiones
        border: COLORS.borderLight,
        ring: COLORS.primary,
        
        // Estados interactivos
        hover: {
          primary: COLORS.primaryDark,
          secondary: COLORS.secondaryDark,
          accent: COLORS.accentLight,
        },
        
        // Textos
        muted: {
          DEFAULT: COLORS.textTertiary,
          foreground: COLORS.textSecondary,
        },
        
        // Superficies
        popover: {
          DEFAULT: COLORS.white,
          foreground: COLORS.textPrimary,
        },
        
        // Alias para compatibilidad
        destructive: {
          DEFAULT: COLORS.error,
          foreground: COLORS.white,
        },
        danger: {
          DEFAULT: COLORS.error,
          foreground: COLORS.white,
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "fade-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "scale-in": {
          "0%": {
            opacity: "0",
            transform: "scale(0.95)"
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)"
          }
        },
        "slide-in-right": {
          "0%": {
            opacity: "0",
            transform: "translateX(20px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)"
          }
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-up": "fade-up 0.6s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.4s ease-out",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
