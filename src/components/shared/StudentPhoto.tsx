import { useEffect, useMemo, useState } from 'react';
import { User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  isProfileStoragePath,
  resolveStudentProfilePhotoUrl,
  resolveStudentProfilePhotoUrlAsync,
} from '@/lib/utils/profilePhoto';
import { cn } from '@/lib/utils';

interface StudentPhotoProps {
  src?: string | null;
  name?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  /** Prioridad de carga: baja en listados largos */
  priority?: 'low' | 'auto';
}

export const StudentPhoto = ({
  src,
  name = '',
  className,
  imageClassName,
  fallbackClassName,
  priority = 'low',
}: StudentPhotoProps) => {
  /** URL pública resuelta al instante (sin round-trip a Storage). */
  const syncUrl = useMemo(
    () => (src?.trim() ? resolveStudentProfilePhotoUrl(src) : null),
    [src],
  );
  const needsAsync = Boolean(src?.trim() && !syncUrl && isProfileStoragePath(src));
  const [photoSrc, setPhotoSrc] = useState<string | null>(syncUrl);
  const [loading, setLoading] = useState(needsAsync);

  useEffect(() => {
    setPhotoSrc(syncUrl);
    if (!src?.trim()) {
      setLoading(false);
      return;
    }
    if (syncUrl) {
      setLoading(false);
      return;
    }
    if (!needsAsync) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void resolveStudentProfilePhotoUrlAsync(src).then((url) => {
      if (cancelled) return;
      setPhotoSrc(url);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [src, syncUrl, needsAsync]);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <Avatar className={cn('rounded-2xl', className)}>
      {photoSrc && !loading ? (
        <AvatarImage
          src={photoSrc}
          alt={name}
          loading={priority === 'low' ? 'lazy' : 'eager'}
          decoding="async"
          className={cn('object-cover', imageClassName)}
          onError={() => setPhotoSrc(null)}
        />
      ) : null}
      <AvatarFallback className={cn('rounded-2xl bg-muted/60 text-muted-foreground', fallbackClassName)}>
        {initials ? (
          <span className={cn(!fallbackClassName && 'text-sm font-semibold')}>{initials}</span>
        ) : (
          <User className="h-8 w-8" />
        )}
      </AvatarFallback>
    </Avatar>
  );
};
