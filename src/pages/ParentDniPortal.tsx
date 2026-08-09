import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, GraduationCap, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SCHOOL_NAME } from '@/config/siteSeo';
import { toast } from 'sonner';

/** Portal público para padres — solo DNI del estudiante. */
export function ParentDniPortal() {
  const navigate = useNavigate();
  const [dni, setDni] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = dni.trim();
    if (!trimmed) {
      toast.error('Ingrese el DNI del estudiante');
      return;
    }
    navigate(`/llegada/dni/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]" lang="es">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-10 pt-8">
        <Link
          to="/login"
          className="mb-8 inline-flex items-center gap-1 text-xs text-[#6B7280] transition-colors hover:text-[#5B21E6]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Volver al login
        </Link>

        <header className="mb-10 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#DDD6FE] bg-[#EDE9FE]">
            <GraduationCap className="h-5 w-5 text-[#5B21E6]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5B21E6]">
              {SCHOOL_NAME}
            </p>
            <p className="text-xs text-[#6B7280]">Portal de padres y apoderados</p>
          </div>
        </header>

        <div className="flex-1 rounded-[14px] border border-[#E2E8F0] bg-white p-6 shadow-sm shadow-[#5B21E6]/[0.04]">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E8B4B8] bg-[#FCEEEF]">
              <Users className="h-5 w-5 text-[#7C3AED]" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-[#0F172A]">Consultar asistencia</h1>
              <p className="mt-0.5 text-xs text-[#6B7280]">Ingresa el DNI de tu hijo/a</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent-dni" className="text-sm text-[#6B7280]">
                DNI del estudiante
              </Label>
              <Input
                id="parent-dni"
                type="text"
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                className="h-12 border-[#E2E8F0] bg-[#F8FAFC] text-center text-lg font-semibold tracking-widest text-[#0F172A] placeholder:text-[#475569] focus-visible:ring-[#5B21E6]/30"
                placeholder="Ej. 70234567"
                autoComplete="off"
                maxLength={12}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={!dni.trim()}
              className="h-12 w-full bg-[#5B21E6] text-base font-semibold text-white hover:bg-[#4C1D95]"
            >
              <Search className="mr-2 h-4 w-4" aria-hidden />
              Ver asistencia
            </Button>
          </form>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-[#475569]">
            El DNI es el mismo código que aparece en el carnet escolar del estudiante.
          </p>
        </div>

        <footer className="mt-8 text-center text-[11px] leading-relaxed text-[#475569]">
          <h2 className="sr-only">Acerca del portal familiar</h2>
          <p>
            Portal de padres y apoderados del {SCHOOL_NAME}. Consulte la asistencia y llegadas del
            día a través del Sistema de Incidencias Escolares (SIE Asiscole).
          </p>
        </footer>
      </div>
    </div>
  );
}
