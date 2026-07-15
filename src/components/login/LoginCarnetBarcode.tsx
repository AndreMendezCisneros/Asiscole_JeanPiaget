import { useMemo } from 'react';
import { getCode128Segments } from '@/lib/utils/code128Bars';

type LoginCarnetBarcodeProps = {
  value: string;
  className?: string;
};

/** Código de barras Code 128 estilizado (negro sobre blanco, proporciones reales). */
export function LoginCarnetBarcode({ value, className }: LoginCarnetBarcodeProps) {
  const { segments, moduleCount } = useMemo(() => getCode128Segments(value), [value]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${moduleCount} 32`}
      preserveAspectRatio="none"
      aria-hidden
      role="presentation"
    >
      <rect x={0} y={0} width={moduleCount} height={32} fill="#ffffff" />
      {segments.map((seg) => (
        <rect
          key={`${seg.x}-${seg.width}`}
          x={seg.x}
          y={0}
          width={seg.width}
          height={32}
          fill="#0c0f18"
        />
      ))}
    </svg>
  );
}
