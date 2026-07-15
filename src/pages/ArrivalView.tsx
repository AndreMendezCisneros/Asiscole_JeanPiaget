import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, GraduationCap } from 'lucide-react';
import { arrivalService } from '@/lib/services';
import type { ArrivalRecord, Student } from '@/types';
import { ParentAttendanceDashboard } from '@/components/parent/ParentAttendanceDashboard';

interface PublicInfo {
  arrival: ArrivalRecord | null;
  recentArrivals: ArrivalRecord[];
  student: Student | null;
}

export function ArrivalView() {
  const { id, dni } = useParams<{ id?: string; dni?: string }>();
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dni) {
      arrivalService.getPublicInfoByDNI(decodeURIComponent(dni)).then(
        ({ arrival, recentArrivals, student, error: err }) => {
          if (err || !student) {
            setError(err || 'No se encontró ningún estudiante con ese DNI.');
          } else {
            setInfo({ arrival, recentArrivals, student });
          }
          setLoading(false);
        }
      );
      return;
    }

    const recordId = Number(id);
    if (!id || !Number.isFinite(recordId) || recordId <= 0) {
      setError('Enlace no válido.');
      setLoading(false);
      return;
    }

    arrivalService.getPublicArrivalInfo(recordId).then(({ arrival, recentArrivals, error: err }) => {
      if (err || !arrival) {
        setError(err || 'No se encontró el registro.');
      } else {
        setInfo({ arrival, recentArrivals, student: arrival.student ?? null });
      }
      setLoading(false);
    });
  }, [id, dni]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" />
          <p className="text-sm text-[#6B7280]">Cargando información…</p>
        </div>
      </div>
    );
  }

  if (error || !info?.student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-6">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#F5C97A] bg-[#FEF3DF]">
            <AlertTriangle className="h-8 w-8 text-[#7A4A00]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#1A1D23]">Estudiante no encontrado</h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              {error ?? 'Este enlace no es válido o ya expiró.'}
            </p>
          </div>
          {dni && (
            <p className="text-xs text-[#9095A3]">
              DNI consultado:{' '}
              <span className="font-mono text-[#6B7280]">{decodeURIComponent(dni)}</span>
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Link
              to="/portal-padres"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E8EAF0] bg-white px-4 py-2.5 text-sm font-medium text-[#1A1D23] transition-colors hover:bg-[#F1F2F5]"
            >
              <ChevronLeft className="h-4 w-4" />
              Intentar con otro DNI
            </Link>
            <Link to="/login" className="text-xs text-[#9095A3] transition-colors hover:text-[#6B7280]">
              Ir al login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { arrival, recentArrivals, student } = info;

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1A1D23]" lang="es">
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-6 pb-16">
        <header className="mb-6 flex w-full max-w-[480px] items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#A8D88A] bg-[#EAF4E0]">
            <GraduationCap className="h-5 w-5 text-[#2E6B1A]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2E6B1A]">
              Colegio Jean Piaget
            </p>
            <p className="text-xs text-[#6B7280]">Consulta de asistencia</p>
          </div>
        </header>

        <ParentAttendanceDashboard
          student={student}
          todayArrival={arrival}
          initialMonthArrivals={recentArrivals}
        />

        <div className="mt-6 flex w-full max-w-[480px] items-center justify-between gap-4 rounded-[14px] border border-[#E8EAF0] bg-white px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[#1A1D23]">Portal completo</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">Incidencias, reuniones y más.</p>
          </div>
          <Link
            to="/login"
            className="shrink-0 rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2563EB]"
          >
            Ingresar
          </Link>
        </div>

        <footer className="mt-10 max-w-[480px] space-y-1 text-center text-[11px] text-[#9095A3]">
          <p>Notificación automática — SIE Colegio Jean Piaget</p>
          <p>Este enlace corresponde a un registro oficial de asistencia.</p>
        </footer>
      </div>
    </div>
  );
}
