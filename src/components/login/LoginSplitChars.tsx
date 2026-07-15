interface LoginSplitCharsProps {
  text: string;
  className?: string;
}

/** Letras individuales para animación GSAP (sin plugin SplitText). */
export function LoginSplitChars({ text, className }: LoginSplitCharsProps) {
  return (
    <span className={className} aria-label={text}>
      {text.split('').map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="login-split-char inline-block origin-bottom"
          data-login-char
          aria-hidden
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}
