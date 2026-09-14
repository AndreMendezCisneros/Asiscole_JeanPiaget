/**
 * Colores de marca SIE Asis Academy — reflejan tokens en src/index.css (:root).
 * Paleta Academia Sofía: rojo #E30613 + naranja #F97316.
 */
export const COLORS = {
  primary: 'hsl(355, 95%, 45%)',
  secondary: 'hsl(0, 74%, 42%)',
  accent: 'hsl(25, 95%, 53%)',

  primaryLight: 'hsl(0, 86%, 95%)',
  primaryDark: 'hsl(0, 74%, 32%)',
  secondaryLight: 'hsl(0, 70%, 55%)',
  secondaryDark: 'hsl(0, 75%, 28%)',

  accentLight: 'hsl(25, 95%, 72%)',
  accentDark: 'hsl(25, 90%, 42%)',

  white: 'hsl(0, 0%, 100%)',
  offWhite: 'hsl(210, 40%, 98%)',
  lightGray: 'hsl(214, 32%, 91%)',
  mediumGray: 'hsl(215, 16%, 47%)',
  darkGray: 'hsl(222, 47%, 20%)',
  black: 'hsl(222, 47%, 11%)',

  cream: 'hsl(210, 40%, 98%)',
  beige: 'hsl(214, 32%, 96%)',
  warmGray: 'hsl(214, 32%, 94%)',
  sand: 'hsl(210, 40%, 98%)',

  success: 'hsl(152, 48%, 38%)',
  warning: 'hsl(32, 85%, 46%)',
  error: 'hsl(0, 72%, 38%)',
  info: 'hsl(25, 90%, 42%)',

  background: 'hsl(210, 40%, 98%)',
  backgroundAlt: 'hsl(214, 32%, 96%)',
  backgroundWarm: 'hsl(210, 36%, 97%)',
  paper: 'hsl(0, 0%, 100%)',
  paperAlt: 'hsl(210, 40%, 98%)',

  textPrimary: 'hsl(222, 47%, 11%)',
  textSecondary: 'hsl(215, 16%, 47%)',
  textTertiary: 'hsl(215, 14%, 58%)',
  textOnPrimary: 'hsl(0, 0%, 100%)',
  textOnSecondary: 'hsl(0, 0%, 100%)',
  textOnAccent: 'hsl(0, 0%, 100%)',

  borderLight: 'hsl(214, 32%, 91%)',
  borderMedium: 'hsl(214, 25%, 85%)',
  borderDark: 'hsl(215, 16%, 47%)',

  shadow: 'none',
  shadowMd: 'none',
  shadowLg: 'none',

  gradientPrimary: 'linear-gradient(135deg, hsl(355, 95%, 45%) 0%, hsl(0, 74%, 32%) 100%)',
  gradientSecondary: 'linear-gradient(135deg, hsl(0, 74%, 42%) 0%, hsl(25, 95%, 53%) 100%)',
  gradientAccent: 'linear-gradient(135deg, hsl(25, 95%, 53%) 0%, hsl(48, 96%, 53%) 100%)',
  gradientWarm: 'linear-gradient(135deg, hsl(210, 40%, 98%) 0%, hsl(214, 32%, 96%) 100%)',
  gradientHero: 'linear-gradient(135deg, hsl(0, 70%, 6%) 0%, hsl(0, 55%, 14%) 100%)',

  overlay: 'rgba(15, 23, 42, 0.5)',
  primary10: 'hsla(355, 95%, 45%, 0.1)',
  secondary10: 'hsla(0, 74%, 42%, 0.1)',
  accent10: 'hsla(25, 95%, 53%, 0.12)',
} as const;

export const THEME = {
  colors: COLORS,
  fontFamily: {
    sans: ['Inter', 'Nunito', 'sans-serif'],
    display: ['Nunito', 'Inter', 'sans-serif'],
    mono: ['IBM Plex Mono', 'Menlo', 'monospace'],
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  borderRadius: {
    none: '0px',
    sm: '0.25rem',
    DEFAULT: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '1.75rem',
    card: '1.75rem',
    full: '9999px',
  },
  boxShadow: {
    sm: 'none',
    DEFAULT: 'none',
    md: 'none',
    lg: 'none',
    xl: 'none',
    '2xl': 'none',
    inner: 'none',
    none: 'none',
  },
} as const;
