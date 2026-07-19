import { useState, useEffect, useRef, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Search, Users, CheckCircle, AlertCircle, Loader2, LogOut, AlertTriangle } from 'lucide-react';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
} from '@/components/staff';
import { Label } from '@/components/ui/label';
import { arrivalService, authService, whatsappService } from '@/lib/services';
import type { ArrivalRecord, EducationalLevel } from '@/types';
import { toast } from 'sonner';
import { staffNotify } from '@/lib/utils/staffNotify';

const GRADES = ['1ro', '2do', '3ro', '4to', '5to', '6to'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const ArrivalControl = () => {
  const [records, setRecords] = useState<ArrivalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'A tiempo' | 'Tarde'>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const isMountedRef = useRef(true);
  
  // Obtener fecha actual en formato YYYY-MM-DD
  const getTodayDate = () => {
    const nowLima = new Date().toLocaleString('es-PE', { 
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [dd, mm, yyyy] = nowLima.split('/');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  };
  
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());

  useEffect(() => {
    isMountedRef.current = true;
    loadArrivals();
    
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const loadArrivals = async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    try {
      const { records: arrivals, error } = await arrivalService.getArrivals({ date: selectedDate });

      if (!isMountedRef.current) return;

      if (error) {
        toast.error('Error al cargar llegadas');
        setRecords([]);
      } else {
        setRecords(arrivals);
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en loadArrivals:', error);
      toast.error('Error al procesar las llegadas');
      setRecords([]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleRegisterDeparture = async (recordId: number) => {
    if (!isMountedRef.current) return;
    
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe estar autenticado para registrar salidas');
      return;
    }

    const existing = records.find((r) => r.id === recordId);

    const { successCount, error, updatedIds, departureTime } =
      await arrivalService.createBulkDepartureRecords([recordId], currentUser.id, 'Normal');

    if (!isMountedRef.current) return;

    if (error || successCount === 0) {
      toast.error(error || 'No se pudo registrar la salida');
    } else {
      if (whatsappService.isEnabled() && existing?.student && updatedIds.includes(recordId)) {
        void whatsappService
          .notifyParentDeparture(existing.student, {
            ...existing,
            departureTime: departureTime || existing.departureTime,
            departureType: 'Normal',
          })
          .then((wa) => {
            if (!isMountedRef.current) return;
            if (!wa.ok && wa.error) {
              toast.warning(`WhatsApp: ${wa.error}`, { duration: 4500 });
            }
          });
      }
      staffNotify.success('¡Salida registrada!', 'El registro de asistencia quedó actualizado');
      loadArrivals(); // Recargar los registros
    }
  };

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const studentName = record.student?.fullName ?? '';
        const matchesSearch = studentName
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
        const matchesLevel =
          levelFilter === 'all' || record.student?.level === levelFilter;
        const matchesGrade =
          gradeFilter === 'all' || record.student?.grade === gradeFilter;
        const matchesSection =
          sectionFilter === 'all' || record.student?.section === sectionFilter;
        return matchesSearch && matchesStatus && matchesLevel && matchesGrade && matchesSection;
      }),
    [records, searchTerm, statusFilter, levelFilter, gradeFilter, sectionFilter],
  );

  const filteredStats = useMemo(() => {
    const onTime = filteredRecords.filter((r) => r.status === 'A tiempo').length;
    const late = filteredRecords.filter((r) => r.status === 'Tarde').length;
    return { total: filteredRecords.length, onTime, late };
  }, [filteredRecords]);

  const onTimePct =
    filteredStats.total > 0
      ? Math.round((filteredStats.onTime / filteredStats.total) * 100)
      : 0;

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={Clock}
        eyebrow="Asistencia"
        title="Control de Llegadas"
        description={`Registro y seguimiento de ingresos ${selectedDate === getTodayDate() ? 'del día de hoy' : `del ${new Date(selectedDate).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`}`}
        accent="success"
      />

      <div className="app-kpi-grid !grid-cols-1 sm:!grid-cols-3">
        <StaffKpiStat
          label="Total llegadas"
          value={filteredStats.total}
          icon={Users}
          tone="primary"
        />
        <StaffKpiStat
          label="A tiempo"
          value={filteredStats.onTime}
          hint={`${onTimePct}% del total`}
          hintIcon={CheckCircle}
          icon={CheckCircle}
          tone="success"
        />
        <StaffKpiStat
          label="Tarde"
          value={filteredStats.late}
          hint="Requieren seguimiento"
          hintIcon={AlertCircle}
          icon={AlertCircle}
          tone="warning"
        />
      </div>

      <StaffToolbar title="Filtros del día" description="Fecha, estudiante, nivel, grado, sección y estado">
        <div className="col-span-full grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={getTodayDate()}
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label>Buscar estudiante</Label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nombre completo del estudiante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="min-w-[12rem] pl-10"
              />
            </div>
          </div>
        </div>
        <div className="col-span-full grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Nivel</Label>
            <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as 'all' | EducationalLevel)}>
              <SelectTrigger>
                <SelectValue placeholder="Nivel educativo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Primaria">Primaria</SelectItem>
                <SelectItem value="Secundaria">Secundaria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Grado</Label>
            <Select value={gradeFilter} onValueChange={(value) => setGradeFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {GRADES.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sección</Label>
            <Select value={sectionFilter} onValueChange={(value) => setSectionFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {SECTIONS.map((section) => (
                  <SelectItem key={section} value={section}>
                    {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
          <Select value={statusFilter} onValueChange={(value: 'all' | 'A tiempo' | 'Tarde') => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="A tiempo">A tiempo</SelectItem>
              <SelectItem value="Tarde">Tarde</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title="Registros del día"
          description={`${filteredRecords.length} visibles · actualice para refrescar`}
          action={
            <Button onClick={loadArrivals} variant="outline" size="sm" disabled={loading}>
              Actualizar
            </Button>
          }
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Cargando registros...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <StaffEmptyState
              icon={Users}
              title="Sin registros"
              description="No hay llegadas para la fecha o filtros seleccionados"
            />
          ) : (
            <div className="app-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Nivel / Grado</TableHead>
                  <TableHead>Hora de Llegada</TableHead>
                  <TableHead>Hora de Salida</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.student?.fullName}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold">{record.student?.level}</span>
                        <span className="text-muted-foreground">
                          {record.student?.grade} - {record.student?.section}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {record.arrivalTime}
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.departureTime ? (
                        <div className="flex items-center gap-2">
                          <LogOut className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{record.departureTime}</span>
                          {record.departureType === 'Autorizada' && (
                            <Badge variant="outline" className="text-xs">Autorizada</Badge>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">Sin salida</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={record.status === 'A tiempo' ? 'default' : 'destructive'}
                        className={
                          record.status === 'A tiempo'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        }
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {record.registeredByUser?.fullName || 'Sistema'}
                    </TableCell>
                    <TableCell>
                      {!record.departureTime && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRegisterDeparture(record.id)}
                          className="gap-2"
                        >
                          <LogOut className="h-4 w-4" />
                          Registrar Salida
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </StaffDataPanel>
    </div>
  );
};
