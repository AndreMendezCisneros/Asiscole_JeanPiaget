import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, GraduationCap } from 'lucide-react';
import { arrivalService } from '@/lib/services';
import type { ArrivalRecord, Student } from '@/types';
import { ParentAttendanceDashboard } from '@/components/parent/ParentAttendanceDashboard';
import { SCHOOL_NAME, SCHOOL_SHORT } from '@/config/siteSeo';

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
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#5B21E6] border-t-transparent" />
          <p className="text-sm text-[#6B7280]">Cargando información…</p>
        </div>
      </div>
    );
  }

  if (error || !info?.student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6">
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#E8B4B8] bg-[#FCEEEF]">
            <AlertTriangle className="h-8 w-8 text-[#7C3AED]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#0F172A]">Estudiante no encontrado</h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              {error ?? 'Este enlace no es válido o ya expiró.'}
            </p>
          </div>
          {dni && (
            <p className="text-xs text-[#475569]">
              DNI consultado:{' '}
              <span className="font-mono text-[#6B7280]">{decodeURIComponent(dni)}</span>
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Link
              to="/portal-padres"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-medium text-[#5B21E6] transition-colors hover:bg-[#EDE9FE]"
            >
              <ChevronLeft className="h-4 w-4" />
              Intentar con otro DNI
            </Link>
            <Link to="/login" className="text-xs text-[#475569] transition-colors hover:text-[#5B21E6]">
              Ir al login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { arrival, recentArrivals, student } = info;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]" lang="es">
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-6 pb-16">
        <header className="mb-6 flex w-full max-w-[480px] items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#EDE9FE]">
            <GraduationCap className="h-5 w-5 text-[#5B21E6]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5B21E6]">
              {SCHOOL_NAME}
            </p>
            <p className="text-xs text-[#6B7280]">Consulta de asistencia</p>
          </div>
        </header>

        <ParentAttendanceDashboard
          student={student}
          todayArrival={arrival}
          initialMonthArrivals={recentArrivals}
        />

        <div className="mt-6 flex w-full max-w-[480px] items-center justify-between gap-4 rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm shadow-[#5B21E6]/[0.04]">
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Portal completo</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">Incidencias, reuniones y más.</p>
          </div>
          <Link
            to="/login"
            className="shrink-0 rounded-lg bg-[#5B21E6] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4C1D95]"
          >
            Ingresar
          </Link>
        </div>

        <footer className="mt-10 max-w-[480px] space-y-1 text-center text-[11px] text-[#475569]">
          <p>Notificación automática — SIE {SCHOOL_SHORT}</p>
          <p>Este enlace corresponde a un registro oficial de asistencia.</p>
        </footer>
      </div>
    </div>
  );
}
