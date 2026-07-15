import { SCHOOL_NAME } from '@/config/siteSeo';

const CARNET_SRC = '/Carnet-JeanPiaget.png';

/**
 * Carnet real del Colegio Jean Piaget en la escena de login
 * (marco + animaciones GSAP sobre el wrapper de la imagen).
 */
export function LoginHeroIllustration() {
  return (
    <div className="login-hero-visual login-carnet-scene" aria-hidden>
      <div className="login-carnet-scene__halo" data-login-visual-halo />
      <div className="login-carnet-scene__glow-ring" data-login-visual-glow-ring aria-hidden />
      <div className="login-carnet-scene__pulse" data-login-visual-pulse-ring aria-hidden />

      <div className="login-carnet-scene__frame" data-login-visual-inner>
        <div className="login-carnet-scanner" data-login-visual-scanner>
          <div className="login-carnet-scanner__frame" aria-hidden>
            <span className="login-carnet-scanner__corner login-carnet-scanner__corner--tl" />
            <span className="login-carnet-scanner__corner login-carnet-scanner__corner--tr" />
            <span className="login-carnet-scanner__corner login-carnet-scanner__corner--bl" />
            <span className="login-carnet-scanner__corner login-carnet-scanner__corner--br" />
          </div>

          <div
            className="login-carnet-card login-carnet-replica login-carnet-replica--photo"
            data-login-visual-card
          >
            <div className="login-carnet-replica__edge-glow" data-login-visual-edge-glow aria-hidden />
            <div className="login-carnet-card__flash" data-login-visual-flash aria-hidden />
            <div className="login-carnet-card__success-ring" data-login-visual-success-ring aria-hidden />

            <div
              className="login-carnet-replica__photo-card"
              data-login-visual-carnet
              data-login-visual-carnet-part="photo"
            >
              <img
                src={CARNET_SRC}
                alt={`Carnet escolar de ejemplo — ${SCHOOL_NAME}`}
                className="login-carnet-replica__photo-card-img"
                width={420}
                height={640}
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
