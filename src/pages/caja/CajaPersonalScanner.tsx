import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, LogIn, LogOut, ScanLine, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { JustificationEvidencePicker } from '@/components/personal/JustificationEvidence';
import { authService } from '@/lib/services';
import { personalService } from '@/lib/services/personalService';
import { personalAttendanceService } from '@/lib/services/personalAttendanceService';
import { MIN_JUSTIFICATION_REASON_LENGTH } from '@/lib/utils/attendanceJustification';
import { getLimaNow } from '@/lib/utils/limaDateTime';
import { scheduleForDate } from '@/lib/utils/personalSchedule';
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
 * o buscando por nombre, y puede autorizar una salida anticipada. No ve
 * estudiantes ni registra incidencias.
 */
export const CajaPersonalScanner = () => {
  const [phase, setPhase] = useState<Phase>(() => (getLimaNow().time >= '12:00' ? 'salida' : 'llegada'));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Personal[]>([]);
  const [searching, setSearching] = useState(false);
  const [last, setLast] = useState<LastScan | null>(null);
  const [recent, setRecent] = useState<{ id: string; name: string; time: string; status: string }[]>([]);
  const [authorizing, setAuthorizing] = useState<LastScan | null>(null);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const focusCode = () => window.setTimeout(() => codeRef.current?.focus(), 0);

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
    const userId = authService.getCurrentUser()?.id;
    const result =
      phase === 'salida'
        ? await personalAttendanceService.registerDeparture(staff, userId)
        : await personalAttendanceService.registerArrival(staff, userId);
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
    toast.success(`${staff.fullName}: ${status} (${time})`);
    setRecent((prev) => [{ id: `${Date.now()}-${staff.id}`, name: staff.fullName, time, status }, ...prev].slice(0, 8));
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = code.replace(/\r?\n/g, '').trim();
    setCode('');
    if (!raw) return;
    setBusy(true);
    const { personal, error } = await personalService.getByBarcode(raw);
    setBusy(false);
    if (error) {
      toast.error(error);
      focusCode();
      return;
    }
    if (!personal) {
      toast.error('Personal no encontrado');
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

  const openAuthorize = () => {
    if (!last) return;
    setReason('');
    setFile(null);
    setAuthorizing(last);
  };

  const submitAuthorize = async () => {
    const userId = authService.getCurrentUser()?.id;
    if (!authorizing || !userId) return;
    setSaving(true);
    const text = reason.trim();
    const { success, error } = await personalAttendanceService.authorizeEarlyDeparture(authorizing.record.id, userId, text);
    if (!success) {
      setSaving(false);
      toast.error(error ?? 'No se pudo autorizar la salida');
      return;
    }
    if (file) {
      const up = await personalAttendanceService.uploadJustificationEvidence(authorizing.record.id, file, userId, 'salida');
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

  const horarioHoy = last ? scheduleForDate(last.personal.schedule, last.record.date) : null;
  const lastTime = last ? (last.action === 'departure' ? last.record.departureTime : last.record.arrivalTime) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asistencia del personal"
        description="Escanee el carnet o busque por nombre para registrar la llegada o la salida."
        icon={ScanLine}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ToggleGroup
              type="single"
              value={phase}
              onValueChange={(v) => {
                if (v) setPhase(v as Phase);
                focusCode();
              }}
              className="justify-start"
              aria-label="Tipo de registro"
            >
              <ToggleGroupItem value="llegada" aria-label="Llegada" className="px-4">
                <LogIn className="mr-2 h-4 w-4" />
                Llegada
              </ToggleGroupItem>
              <ToggleGroupItem value="salida" aria-label="Salida" className="px-4">
                <LogOut className="mr-2 h-4 w-4" />
                Salida
              </ToggleGroupItem>
            </ToggleGroup>

            <form onSubmit={(e) => void submitCode(e)} className="space-y-2">
              <Label htmlFor="caja-codigo">Código del carnet (DNI)</Label>
              <div className="flex gap-2">
                <Input
                  id="caja-codigo"
                  ref={codeRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  placeholder="Escanee el carnet"
                  disabled={busy}
                />
                <Button type="submit" disabled={busy || !code.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar'}
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <Label htmlFor="caja-buscar">Buscar por nombre</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="caja-buscar"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre o apellido"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              {searching && <p className="text-xs text-muted-foreground">Buscando…</p>}
              {!searching && search.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin resultados.</p>
              )}
              {results.length > 0 && (
                <ul className="divide-y rounded-md border">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 disabled:opacity-50"
                        onClick={() => pickResult(p)}
                        disabled={busy}
                      >
                        <StudentPhoto src={p.profilePhoto} name={p.fullName} className="h-8 w-8 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{p.fullName}</span>
                          <span className="block text-xs text-muted-foreground">{p.position ?? p.category}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Último registro</CardTitle>
          </CardHeader>
          <CardContent>
            {last ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <StudentPhoto src={last.personal.profilePhoto} name={last.personal.fullName} className="h-16 w-16 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{last.personal.fullName}</p>
                    <p className="text-sm text-muted-foreground">{last.personal.position ?? last.personal.category}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={last.duplicate ? 'secondary' : 'default'}>{scanLabel(last.action, last.record)}</Badge>
                  <span className="font-mono text-sm">{lastTime ?? '—'}</span>
                  {last.duplicate && <span className="text-xs text-muted-foreground">(ya estaba registrado)</span>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {horarioHoy
                    ? `Horario de hoy: entrada ${horarioHoy.entry}${horarioHoy.exit ? ` · salida ${horarioHoy.exit}` : ''}`
                    : 'Hoy no le toca asistir (fuera de horario).'}
                </p>
                {last.record.departureType === 'Anticipada' && (
                  <Button type="button" onClick={openAuthorize}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Autorizar salida
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay registros en esta sesión.</p>
            )}

            {recent.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recientes</p>
                <ul className="space-y-1 text-sm">
                  {recent.map((r) => (
                    <li key={r.id} className="flex justify-between gap-3">
                      <span className="truncate">{r.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {r.status} · <span className="font-mono">{r.time}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
