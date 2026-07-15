import { cn } from '@/lib/utils';
import { BRAND_ICON_SVG } from '@/config/brandAssets';

const sizeMap = {
  xs: { box: 'h-4 w-4', img: 16 },
  sm: { box: 'h-5 w-5', img: 20 },
  md: { box: 'h-7 w-7', img: 28 },
  lg: { box: 'h-10 w-10', img: 40 },
  xl: { box: 'h-11 w-11', img: 44 },
  '2xl': { box: 'h-14 w-14', img: 56 },
} as const;

interface GuardyMarkProps {
  size?: keyof typeof sizeMap;
  className?: string;
  /** Solo el escudo (recomendado en UI compacta) */
  iconOnly?: boolean;
  /** Muestra “Guardy” al lado — solo en cabeceras amplias */
  showWordmark?: boolean;
}

/** Marca Guardy — escudo recortado del logo oficial */
export const GuardyMark = ({
  size = 'md',
  className,
  iconOnly = true,
  showWordmark = false,
}: GuardyMarkProps) => {
  const s = sizeMap[size];
  /** Escudo SIE (SVG en la UI) */
  const src = BRAND_ICON_SVG;

  return (
    <span
      className={cn('inline-flex items-center gap-2 shrink-0', className)}
      aria-hidden={iconOnly && !showWordmark}
    >
      <img
        src={src}
        alt=""
        width={s.img}
        height={s.img}
        className={cn(s.box, 'object-contain')}
        draggable={false}
      />
      {showWordmark && (
        <span className="text-sm font-semibold tracking-tight text-inherit">Guardy</span>
      )}
    </span>
  );
};
