/**
 * Colores de marca SIE — reflejan tokens en src/index.css (:root).
 * Fuente canónica: variables CSS (--primary, --success, etc.).
 * Paleta Colegio Jean Piaget: navy + rojo.
 */
export const COLORS = {
  primary: 'hsl(221, 56%, 24%)',
  secondary: 'hsl(221, 42%, 36%)',
  accent: 'hsl(355, 71%, 41%)',

  primaryLight: 'hsl(221, 40%, 94%)',
  primaryDark: 'hsl(221, 60%, 18%)',
  secondaryLight: 'hsl(221, 38%, 48%)',
  secondaryDark: 'hsl(221, 50%, 22%)',

  accentLight: 'hsl(355, 55%, 58%)',
  accentDark: 'hsl(355, 72%, 32%)',

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

  success: 'hsl(152, 48%, 38%)',
  warning: 'hsl(32, 85%, 46%)',
  error: 'hsl(0, 65%, 48%)',
  info: 'hsl(221, 48%, 42%)',

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

  gradientPrimary: 'linear-gradient(135deg, hsl(221, 56%, 24%) 0%, hsl(221, 60%, 18%) 100%)',
  gradientSecondary: 'linear-gradient(135deg, hsl(221, 42%, 36%) 0%, hsl(221, 38%, 48%) 100%)',
  gradientAccent: 'linear-gradient(135deg, hsl(355, 71%, 41%) 0%, hsl(355, 55%, 58%) 100%)',
  gradientWarm: 'linear-gradient(135deg, hsl(240, 5%, 96%) 0%, hsl(220, 14%, 92%) 100%)',
  gradientHero: 'linear-gradient(135deg, hsl(0, 0%, 0%) 0%, hsl(0, 0%, 18%) 100%)',

  overlay: 'rgba(0, 0, 0, 0.5)',
  primary10: 'hsla(221, 56%, 24%, 0.1)',
  secondary10: 'hsla(221, 42%, 36%, 0.1)',
  accent10: 'hsla(355, 71%, 41%, 0.08)',
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
