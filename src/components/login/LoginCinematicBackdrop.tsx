import { useMemo, type CSSProperties } from 'react';

const DUST_COUNT = 22;

function createDust() {
  return Array.from({ length: DUST_COUNT }, (_, index) => ({
    id: index,
    x: 5 + Math.random() * 90,
    y: 4 + Math.random() * 92,
    size: 1 + Math.random() * 2.5,
    tone: index % 3,
  }));
}

/** Escena ambiental: malla de gradientes + polvo sutil (sin explosiones). */
export function LoginCinematicBackdrop() {
  const dust = useMemo(() => createDust(), []);

  return (
    <div className="login-ambient-scene" aria-hidden>
      <div className="login-mesh login-mesh--primary" data-login-mesh />
      <div className="login-mesh login-mesh--accent" data-login-mesh />
      <div className="login-mesh login-mesh--teal" data-login-mesh />

      <div className="login-dust-field">
        {dust.map((dot) => (
          <span
            key={dot.id}
            className={`login-dust login-dust--tone-${dot.tone}`}
            data-login-dust
            style={
              {
                '--dust-x': `${dot.x}%`,
                '--dust-y': `${dot.y}%`,
                '--dust-size': `${dot.size}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="login-grain" data-login-grain />
      <div className="login-vignette" data-login-vignette />
    </div>
  );
}
