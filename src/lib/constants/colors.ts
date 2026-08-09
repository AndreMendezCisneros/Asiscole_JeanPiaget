/**
 * Colores de marca SIE — reflejan tokens en src/index.css (:root).
 * Fuente canónica: variables CSS (--primary, --success, etc.).
 * Paleta Asiscole: morado (#5B21E6) + celeste (#22C7F2).
 */
export const COLORS = {
  primary: 'hsl(258, 80%, 52%)',
  secondary: 'hsl(262, 83%, 58%)',
  accent: 'hsl(280, 91%, 65%)',

  primaryLight: 'hsl(270, 90%, 96%)',
  primaryDark: 'hsl(258, 75%, 40%)',
  secondaryLight: 'hsl(262, 70%, 70%)',
  secondaryDark: 'hsl(262, 75%, 45%)',

  accentLight: 'hsl(280, 85%, 78%)',
  accentDark: 'hsl(280, 80%, 50%)',

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
  error: 'hsl(0, 65%, 48%)',
  info: 'hsl(191, 89%, 54%)',

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

  gradientPrimary: 'linear-gradient(135deg, hsl(258, 80%, 52%) 0%, hsl(262, 83%, 58%) 100%)',
  gradientSecondary: 'linear-gradient(135deg, hsl(262, 83%, 58%) 0%, hsl(280, 91%, 65%) 100%)',
  gradientAccent: 'linear-gradient(135deg, hsl(191, 89%, 54%) 0%, hsl(258, 80%, 52%) 100%)',
  gradientWarm: 'linear-gradient(135deg, hsl(210, 40%, 98%) 0%, hsl(214, 32%, 96%) 100%)',
  gradientHero: 'linear-gradient(135deg, hsl(258, 45%, 6%) 0%, hsl(258, 35%, 14%) 100%)',

  overlay: 'rgba(15, 23, 42, 0.5)',
  primary10: 'hsla(258, 80%, 52%, 0.1)',
  secondary10: 'hsla(262, 83%, 58%, 0.1)',
  accent10: 'hsla(280, 91%, 65%, 0.12)',
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
