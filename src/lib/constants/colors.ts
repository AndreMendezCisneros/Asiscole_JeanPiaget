/**
 * Colores de marca SIE — reflejan tokens en src/index.css (:root).
 * Fuente canónica: variables CSS (--primary, --success, etc.).
 * Paleta IEP Miguel Grau Seminario: navy #164174, rojo #E21D26, oro.
 */
export const COLORS = {
  primary: 'hsl(213, 68%, 27%)',
  secondary: 'hsl(213, 55%, 36%)',
  accent: 'hsl(357, 77%, 46%)',

  primaryLight: 'hsl(213, 40%, 94%)',
  primaryDark: 'hsl(213, 72%, 18%)',
  secondaryLight: 'hsl(213, 45%, 48%)',
  secondaryDark: 'hsl(213, 60%, 22%)',

  accentLight: 'hsl(357, 70%, 58%)',
  accentDark: 'hsl(357, 78%, 36%)',

  white: 'hsl(0, 0%, 100%)',
  offWhite: 'hsl(240, 5%, 98%)',
  lightGray: 'hsl(240, 7%, 91%)',
  mediumGray: 'hsl(0, 0%, 60%)',
  darkGray: 'hsl(240, 4%, 25%)',
  black: 'hsl(0, 0%, 0%)',

  cream: 'hsl(240, 5%, 96%)',
  beige: 'hsl(220, 14%, 92%)',
  warmGray: 'hsl(240, 6%, 94%)',
  sand: 'hsl(240, 5%, 98%)',

  success: 'hsl(125, 40%, 36%)',
  warning: 'hsl(45, 90%, 46%)',
  error: 'hsl(0, 65%, 48%)',
  info: 'hsl(213, 60%, 42%)',

  background: 'hsl(240, 5%, 96%)',
  backgroundAlt: 'hsl(220, 14%, 92%)',
  backgroundWarm: 'hsl(240, 6%, 94%)',
  paper: 'hsl(0, 0%, 100%)',
  paperAlt: 'hsl(240, 5%, 98%)',

  textPrimary: 'hsl(240, 4%, 12%)',
  textSecondary: 'hsl(0, 0%, 47%)',
  textTertiary: 'hsl(0, 0%, 60%)',
  textOnPrimary: 'hsl(0, 0%, 100%)',
  textOnSecondary: 'hsl(0, 0%, 100%)',
  textOnAccent: 'hsl(0, 0%, 100%)',

  borderLight: 'hsl(220, 13%, 91%)',
  borderMedium: 'hsl(240, 7%, 85%)',
  borderDark: 'hsl(0, 0%, 60%)',

  shadow: 'none',
  shadowMd: 'none',
  shadowLg: 'none',

  gradientPrimary: 'linear-gradient(135deg, hsl(213, 68%, 27%) 0%, hsl(213, 72%, 18%) 100%)',
  gradientSecondary: 'linear-gradient(135deg, hsl(213, 55%, 36%) 0%, hsl(213, 45%, 48%) 100%)',
  gradientAccent: 'linear-gradient(135deg, hsl(357, 77%, 46%) 0%, hsl(48, 85%, 52%) 100%)',
  gradientWarm: 'linear-gradient(135deg, hsl(240, 5%, 96%) 0%, hsl(213, 20%, 92%) 100%)',
  gradientHero: 'linear-gradient(135deg, hsl(0, 0%, 0%) 0%, hsl(0, 0%, 18%) 100%)',

  overlay: 'rgba(0, 0, 0, 0.5)',
  primary10: 'hsla(213, 68%, 27%, 0.1)',
  secondary10: 'hsla(213, 55%, 36%, 0.1)',
  accent10: 'hsla(357, 77%, 46%, 0.08)',
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
