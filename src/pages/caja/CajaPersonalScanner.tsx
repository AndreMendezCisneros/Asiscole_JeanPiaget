import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Barcode, CalendarClock, CheckCircle2, Clock, Loader2, LogOut, ScanLine, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GuardyMark } from '@/components/brand/GuardyMark';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { JustificationEvidencePicker } from '@/components/personal/JustificationEvidence';
import { authService } from '@/lib/services';
import { personalService } from '@/lib/services/personalService';
import { personalAttendanceService } from '@/lib/services/personalAttendanceService';
import { MIN_JUSTIFICATION_REASON_LENGTH } from '@/lib/utils/attendanceJustification';
import { getLimaNow } from '@/lib/utils/limaDateTime';
import { scheduleForDate } from '@/lib/utils/personalSchedule';
import { cn } from '@/lib/utils';
import type { Personal, PersonalArrivalRecord } from '@/types/personal';

type Phase = 'llegada' | 'salida';

type LastScan = {
  personal: Personal;
  record: PersonalArrivalRecord;
  action: 'arrival' | 'departure';
  duplicate: boolean;
};

/** Texto del registro de un empleado (mismo criterio que el escáner del tutor). */
function scanLabel(action: 'arrival' | 'departure', record: PersonalArrivalRecord): string {
  if (action === 'departure') {
    if (record.departureType === 'Anticipada') return 'Salida anticipada (sin autorización)';
    if (record.departureType === 'Autorizada') return 'Salida anticipada autorizada';
    return 'Salida';
  }
  if (record.status === 'Falta') return 'Inasistencia (llegó después de su salida)';
  return record.status;
}

/**
 * Caja (secretarías): marca la llegada y la salida del personal con el lector
 * o buscando por nombre, y puede autorizar una salida anticipada. Misma
 * presentación que el escáner del tutor, sin estudiantes ni incidencias.
 */
export const CajaPersonalScanner = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [phase, setPhase] = useState<Phase>(() => (getLimaNow().time >= '12:00' ? 'salida' : 'llegada'));
  const [now, setNow] = useState(() => getLimaNow().time);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Personal[]>([]);
  const [searching, setSearching] = useState(false);
  const [last, setLast] = useState<LastScan | null>(null);
  const [count, setCount] = useState({ total: 0, onTime: 0, late: 0 });
  const [recent, setRecent] = useState<{ id: string; name: string; time: string; status: string }[]>([]);
  const [authorizing, setAuthorizing] = useState<LastScan | null>(null);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const focusCode = () => window.setTimeout(() => codeRef.current?.focus(), 0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(getLimaNow().time), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const id = window.setTimeout(async () => {
      const { personal, error } = await personalService.searchByName(term);
      if (cancelled) return;
      if (error) toast.error(error);
      setResults(personal);
      setSearching(false);
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [search]);

  const register = async (staff: Personal) => {
    if (busy) return;
    setBusy(true);
    const result =
      phase === 'salida'
        ? await personalAttendanceService.registerDeparture(staff, user?.id)
        : await personalAttendanceService.registerArrival(staff, user?.id);
    setBusy(false);
    focusCode();
    if ('error' in result) {
      toast.error(result.error, { duration: 4000 });
      return;
    }
    const { record, action, duplicate } = result;
    setLast({ personal: staff, record, action, duplicate });
    const time = (action === 'departure' ? record.departureTime : record.arrivalTime) ?? getLimaNow().time;
    if (duplicate) {
      toast.info(
        action === 'departure'
          ? `${staff.fullName} ya tiene salida registrada hoy (${time}).`
          : `${staff.fullName} ya registró su llegada hoy a las ${time}. Para salida, elija Salida.`,
        { duration: 3000 },
      );
      return;
    }
    const status = scanLabel(action, record);
    setCount((prev) => ({
      total: prev.total + 1,
      onTime: prev.onTime + (action === 'arrival' && record.status === 'A tiempo' ? 1 : 0),
      late: prev.late + (action === 'arrival' && record.status === 'Tarde' ? 1 : 0),
    }));
    setRecent((prev) => [{ id: `${Date.now()}-${staff.id}`, name: staff.fullName, time, status }, ...prev].slice(0, 6));
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = code.replace(/\r?\n/g, '').trim();
    setCode('');
    if (!raw) return;
    setBusy(true);
    const { personal, error } = await personalService.getByBarcode(raw);
    setBusy(false);
    if (error || !personal) {
      toast.error(error ?? 'Personal no encontrado');
      focusCode();
      return;
    }
    await register(personal);
  };

  const pickResult = (staff: Personal) => {
    setSearch('');
    setResults([]);
    void register(staff);
  };

  const clear = () => {
    setCode('');
    setSearch('');
    setResults([]);
    focusCode();
  };

  const closeProfile = () => {
    setLast(null);
    focusCode();
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      toast.success('Sesión cerrada');
      navigate('/login', { replace: true });
    } catch {
      toast.error('No se pudo cerrar la sesión');
    }
  };

  const openAuthorize = () => {
    if (!last) return;
    setReason('');
    setFile(null);
    setAuthorizing(last);
  };

  const submitAuthorize = async () => {
    if (!authorizing || !user?.id) return;
    setSaving(true);
    const text = reason.trim();
    const { success, error } = await personalAttendanceService.authorizeEarlyDeparture(authorizing.record.id, user.id, text);
    if (!success) {
      setSaving(false);
      toast.error(error ?? 'No se pudo autorizar la salida');
      return;
    }
    if (file) {
      const up = await personalAttendanceService.uploadJustificationEvidence(authorizing.record.id, file, user.id, 'salida');
      if (up.error) toast.error(`Salida autorizada, pero no se pudo subir la evidencia: ${up.error}`);
    }
    setSaving(false);
    toast.success(`Salida de ${authorizing.personal.fullName} autorizada`);
    setLast((prev) =>
      prev && prev.record.id === authorizing.record.id
        ? { ...prev, record: { ...prev.record, departureType: 'Autorizada', departureReason: text } }
        : prev,
    );
    setAuthorizing(null);
    focusCode();
  };

  const isSalida = phase === 'salida';

  return (
    <div className="tutor-page">
      <header className="tutor-header">
        <div className="tutor-header__inner">
          <div className="tutor-header__brand">
            <div className="tutor-header__shield p-1" aria-hidden>
              <GuardyMark size="sm" />
            </div>
            <div className="min-w-0">
              <p className="tutor-header__title">Asistencia del personal</p>
              <p className="tutor-header__subtitle hidden sm:block">SIE — Caja</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 shrink-0 lg:hidden">
              {now}
            </Badge>
            <span className="tutor-header__user">{user?.fullName}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate('/pensiones')}
              className="border-[var(--tutor-lead)] bg-transparent text-[var(--tutor-starlight)] hover:bg-[var(--tutor-graphite)] hover:text-[var(--tutor-starlight)]"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Pensiones</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleLogout()}
              className="tutor-header__logout border-[var(--tutor-lead)] bg-transparent text-[var(--tutor-starlight)] hover:bg-[var(--tutor-graphite)] hover:text-[var(--tutor-starlight)]"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="tutor-main">
        <div className="tutor-grid">
          <section className="tutor-left">
            <div className="tutor-scan-card">
              <div className="tutor-scan-card__head">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <ScanLine className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary">
                      {isSalida ? 'Registro de salida' : 'Registro de llegada'}
                    </p>
                    <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
                      {isSalida ? 'Escanear salida del personal' : 'Escanear o buscar personal'}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Elija Llegada o Salida, luego carnet con lector o búsqueda por nombre.
                    </p>
                  </div>
                </div>
              </div>

              <CardContent className="p-5 sm:p-7 pt-5 sm:pt-6">
                <form onSubmit={(e) => void submitCode(e)} className="space-y-5" aria-busy={busy}>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Registro</Label>
                    <div className="grid max-w-sm grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-1">
                      <Button
                        type="button"
                        variant={phase === 'llegada' ? 'default' : 'ghost'}
                        onClick={() => {
                          setPhase('llegada');
                          focusCode();
                        }}
                        className="w-full"
                      >
                        Llegada
                      </Button>
                      <Button
                        type="button"
                        variant={phase === 'salida' ? 'default' : 'ghost'}
                        onClick={() => {
                          setPhase('salida');
                          focusCode();
                        }}
                        className="w-full"
                      >
                        Salida
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isSalida
                        ? 'Escanee para registrar la hora de salida (debe haber llegada primero).'
                        : 'Escanee para registrar la hora de llegada.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="caja-codigo" className="text-sm font-medium text-foreground">
                      Código de barras
                    </Label>
                    <Input
                      ref={codeRef}
                      id="caja-codigo"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') clear();
                      }}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="off"
                      autoFocus
                      placeholder="Escanee el carnet o escriba DNI…"
                      className="tutor-scan-input"
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border bg-muted/20 px-2 py-1 font-mono">Enter</span>
                      <span>Registrar</span>
                      <span className="mx-1">·</span>
                      <span className="rounded-full border border-border bg-muted/20 px-2 py-1 font-mono">Esc</span>
                      <span>Limpiar</span>
                    </div>
                  </div>

                  <div className="relative space-y-2">
                    <Label htmlFor="caja-buscar" className="text-sm font-medium text-foreground">
                      Buscar por nombre
                    </Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="caja-buscar"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') clear();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (results.length === 1) pickResult(results[0]);
                          }
                        }}
                        placeholder="Nombre o apellido…"
                        autoComplete="off"
                        enterKeyHint="search"
                        disabled={busy}
                        className="tutor-field-input pl-9 min-h-12 sm:min-h-10"
                      />
                      {searching && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {!searching && search.trim().length >= 2 && results.length === 0 && (
                      <p className="text-xs text-muted-foreground">No se encontró personal activo.</p>
                    )}
                    {results.length > 0 && (
                      <div
                        role="listbox"
                        aria-label="Personal encontrado"
                        className="tutor-name-search-results w-full rounded-xl border border-border bg-popover shadow-xl"
                      >
                        {results.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => pickResult(p)}
                            className="tutor-name-search-results__row flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none sm:px-4 sm:py-4"
                          >
                            <StudentPhoto
                              src={p.profilePhoto}
                              name={p.fullName}
                              className="tutor-name-search-results__photo h-16 w-16 shrink-0 rounded-xl sm:h-[4.5rem] sm:w-[4.5rem]"
                              imageClassName="object-cover object-center"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-base leading-snug text-foreground sm:text-lg">
                                {p.fullName}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                                <span className="font-mono font-semibold text-foreground/90">DNI {p.barcode}</span>
                                <span aria-hidden>·</span>
                                <span>{p.position ?? p.category}</span>
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                    <Button type="button" variant="outline" onClick={clear} disabled={busy} className="sm:min-w-[120px]">
                      Limpiar
                    </Button>
                    <Button type="submit" disabled={busy || !code.trim()} className="sm:min-w-[180px]">
                      {busy ? (
                        <>
                          <Clock className="h-4 w-4 animate-spin" />
                          Registrando…
                        </>
                      ) : (
                        <>
                          <Barcode className="h-4 w-4" />
                          {isSalida ? 'Registrar salida' : 'Registrar llegada'}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </div>
          </section>

          <aside className="tutor-right">
            {last && (() => {
              const { personal: staff, record, action } = last;
              const horarioHoy = scheduleForDate(staff.schedule, record.date);
              const warn =
                (action === 'arrival' && (record.status === 'Tarde' || record.status === 'Falta')) ||
                record.departureType === 'Anticipada';
              const timeLabel = (action === 'departure' ? record.departureTime : record.arrivalTime) ?? '—:—';
              return (
                <>
                  <button
                    type="button"
                    className="tutor-student-backdrop lg:hidden"
                    aria-label="Cerrar perfil del personal"
                    onClick={closeProfile}
                  />
                  <div
                    key={`p-${staff.id}`}
                    className={cn('tutor-student-card', warn ? 'tutor-student-card--late' : 'tutor-student-card--ontime')}
                    role="region"
                    aria-label={`Registro de ${staff.fullName}`}
                  >
                    <div className="tutor-student-card__banner" aria-hidden />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="tutor-student-card__close"
                      onClick={closeProfile}
                    >
                      <X className="h-5 w-5" />
                      <span className="sr-only">Cerrar</span>
                    </Button>
                    <div className="tutor-student-card__scroll">
                      <div className="tutor-student-card__hero-sticky">
                        <div className="tutor-identity tutor-identity--sheet">
                          <div className="tutor-identity__photo-frame">
                            <StudentPhoto
                              src={staff.profilePhoto}
                              name={staff.fullName}
                              priority="auto"
                              className="h-full w-full rounded-2xl"
                              imageClassName="object-cover object-[center_20%]"
                            />
                          </div>
                          <div className="tutor-identity__meta">
                            <Badge variant={warn ? 'warning' : 'success'} className="tutor-student-card__status">
                              {scanLabel(action, record)} · {timeLabel}
                            </Badge>
                            <h3 className="tutor-identity__name">{staff.fullName}</h3>
                            <p className="tutor-identity__grade">Personal · {staff.position ?? staff.category}</p>
                            <p className="tutor-identity__dni font-mono">{staff.barcode}</p>
                            {last.duplicate && (
                              <p className="text-xs text-muted-foreground">Ya estaba registrado hoy.</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="tutor-schedule" aria-label="Horario de hoy">
                        <div className="tutor-schedule__head">
                          <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="font-semibold text-sm">Horario de hoy</span>
                        </div>
                        <p className="text-sm">
                          {horarioHoy
                            ? `Entrada ${horarioHoy.entry}${horarioHoy.exit ? ` · Salida ${horarioHoy.exit}` : ''}`
                            : 'Hoy no le toca asistir (fuera de horario).'}
                        </p>
                      </div>
                      <div className="tutor-student-card__actions">
                        {record.departureType === 'Anticipada' && (
                          <Button type="button" variant="default" size="lg" onClick={openAuthorize}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Autorizar salida
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          onClick={closeProfile}
                          className="tutor-student-card__btn-next"
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="tutor-side-stack hidden lg:block">
              <div className="tutor-side-card">
                <div className="tutor-side-card__head">
                  <CardTitle className="text-base font-semibold">Estado del turno</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Hora local Lima y conteo de registros en esta sesión.</p>
                </div>
                <div className="tutor-meta">
                  <div className="tutor-meta__item">
                    <p className="tutor-meta__k">Hora actual</p>
                    <p className="tutor-meta__v">{now}</p>
                  </div>
                  <div className="tutor-meta__item">
                    <p className="tutor-meta__k">Modo</p>
                    <p className="tutor-meta__v">{isSalida ? 'Salida' : 'Llegada'}</p>
                  </div>
                </div>
                <div className="tutor-kpis">
                  <div className="tutor-kpi">
                    <p className="tutor-kpi__value">{count.total}</p>
                    <p className="tutor-kpi__label">Total</p>
                  </div>
                  <div className="tutor-kpi">
                    <p className="tutor-kpi__value">{count.onTime}</p>
                    <p className="tutor-kpi__label">A tiempo</p>
                  </div>
                  <div className="tutor-kpi">
                    <p className="tutor-kpi__value">{count.late}</p>
                    <p className="tutor-kpi__label">Tarde</p>
                  </div>
                </div>
              </div>

              <div className="tutor-side-card">
                <div className="tutor-side-card__head">
                  <CardTitle className="text-base font-semibold">Últimos escaneos</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Historial rápido (máx. 6).</p>
                </div>
                <div className="tutor-feed">
                  {recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aún no hay registros en esta sesión. Escanee el primer carnet para empezar.
                    </p>
                  ) : (
                    recent.map((row) => (
                      <div key={row.id} className="tutor-feed__row">
                        <span className="tutor-feed__name">{row.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="tutor-feed__time">{row.time}</span>
                          <Badge
                            variant={row.status === 'A tiempo' ? 'success' : row.status === 'Tarde' ? 'warning' : 'secondary'}
                          >
                            {row.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Dialog
        open={authorizing !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setAuthorizing(null);
            focusCode();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Autorizar salida del personal</DialogTitle>
            <DialogDescription>
              {authorizing
                ? `${authorizing.personal.fullName} salió a las ${authorizing.record.departureTime ?? '—'}, antes de su hora de salida. Quedará como salida autorizada.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="caja-auth-salida">Motivo</Label>
            <Textarea
              id="caja-auth-salida"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: cita médica, permiso de Dirección…"
              rows={3}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Mínimo {MIN_JUSTIFICATION_REASON_LENGTH} caracteres.</p>
          </div>
          <JustificationEvidencePicker file={file} onChange={setFile} disabled={saving} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAuthorizing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || reason.trim().length < MIN_JUSTIFICATION_REASON_LENGTH}
              onClick={() => void submitAuthorize()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Autorizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
