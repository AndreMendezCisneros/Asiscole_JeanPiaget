import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Pencil, Trash2, FileText, User, Clock3, Activity } from 'lucide-react';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
} from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { auditService } from '@/lib/services';
import type { AuditLog } from '@/types';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ChangeRow = { field: string; before: string; after: string };

const TABLE_LABELS: Record<string, string> = {
  incidencias: 'Incidencias',
  estudiantes: 'Estudiantes',
  catalogo_faltas: 'Catálogo de faltas',
  citas_padres: 'Citas con padres',
  registros_llegada: 'Registro de llegadas/salidas',
  usuarios: 'Usuarios',
  configuracion_sistema: 'Configuración del sistema',
  configuracion_reincidencia: 'Configuración de reincidencia',
  auditoria_logs: 'Auditoría',
};

const FIELD_LABELS: Record<string, string> = {
  nombre_completo: 'Nombre completo',
  fecha_hora_registro: 'Fecha de registro',
  nivel_reincidencia: 'Nivel de reincidencia',
  id_estudiante: 'ID estudiante',
  id_falta: 'ID falta',
  id_usuario: 'ID usuario',
  id_usuario_registro: 'Usuario que registró',
  observaciones: 'Observaciones',
  estado: 'Estado',
  puntos_reincidencia: 'Puntos de reincidencia',
  es_grave: 'Es falta grave',
  descripcion: 'Descripción',
  activo: 'Activo',
  valor: 'Valor',
  clave: 'Clave',
};

const OPERATION_LABELS: Record<AuditLog['operation'], string> = {
  INSERT: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
};

const OPERATION_SHORT_HINT: Record<AuditLog['operation'], string> = {
  INSERT: 'Se creó un registro nuevo',
  UPDATE: 'Se modificó un registro existente',
  DELETE: 'Se eliminó un registro',
};

function humanizeKey(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (m) => m.toUpperCase());
}

function tableLabel(table: string): string {
  return TABLE_LABELS[table] || humanizeKey(table);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string') return value.trim() === '' ? '—' : value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length === 0 ? '—' : `${value.length} elementos`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getChangeRows(log: AuditLog): ChangeRow[] {
  const before = (log.previousData && typeof log.previousData === 'object' ? log.previousData : {}) as Record<string, unknown>;
  const after = (log.newData && typeof log.newData === 'object' ? log.newData : {}) as Record<string, unknown>;

  if (log.operation === 'INSERT') {
    return Object.keys(after).map((key) => ({
      field: humanizeKey(key),
      before: '—',
      after: formatValue(after[key]),
    }));
  }

  if (log.operation === 'DELETE') {
    return Object.keys(before).map((key) => ({
      field: humanizeKey(key),
      before: formatValue(before[key]),
      after: 'Eliminado',
    }));
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: ChangeRow[] = [];
  keys.forEach((key) => {
    const previous = formatValue(before[key]);
    const next = formatValue(after[key]);
    if (previous !== next) {
      changes.push({ field: humanizeKey(key), before: previous, after: next });
    }
  });
  return changes;
}

function summarizeLog(log: AuditLog, changesCount: number): string {
  const action = OPERATION_LABELS[log.operation];
  const target = tableLabel(log.table);
  const record = log.recordId ? ` (#${log.recordId})` : '';
  if (log.operation === 'UPDATE') {
    return `${action} en ${target}${record}. Se detectaron ${changesCount} cambio${changesCount === 1 ? '' : 's'}.`;
  }
  if (log.operation === 'INSERT') {
    return `${action} en ${target}${record}. Se registró un nuevo elemento.`;
  }
  return `${action} en ${target}${record}. El registro fue retirado del sistema.`;
}

export const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const pageSize = 20;

  useEffect(() => {
    void loadLogs();
    loadStats();
  }, [currentPage, selectedTable, selectedOperation, startDate, endDate]);

  const loadLogs = async (): Promise<void> => {
    setLoading(true);
    const filters: {
      limit: number;
      offset: number;
      table?: string;
      operation?: 'INSERT' | 'UPDATE' | 'DELETE';
      startDate?: string;
      endDate?: string;
    } = {
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    };

    if (selectedTable) filters.table = selectedTable;
    if (selectedOperation) filters.operation = selectedOperation as 'INSERT' | 'UPDATE' | 'DELETE';
    if (startDate) filters.startDate = `${startDate}T00:00:00`;
    if (endDate) filters.endDate = `${endDate}T23:59:59`;

    const { logs: fetchedLogs, total: fetchedTotal, error } = await auditService.getAuditLogs(filters);

    if (error) {
      toast.error('Error al cargar logs de auditoría');
    } else {
      setLogs(fetchedLogs);
      setTotal(fetchedTotal);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    const { stats: fetchedStats } = await auditService.getAuditStats(7);
    setStats(fetchedStats);
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'INSERT':
        return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400';
      case 'DELETE':
        return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-400';
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const selectedLogChanges = useMemo(() => (selectedLog ? getChangeRows(selectedLog) : []), [selectedLog]);
  const pageOperationCounts = useMemo(
    () => ({
      inserts: logs.filter((l) => l.operation === 'INSERT').length,
      updates: logs.filter((l) => l.operation === 'UPDATE').length,
      deletes: logs.filter((l) => l.operation === 'DELETE').length,
    }),
    [logs]
  );

  const uniqueTables = Array.from(new Set(stats?.byTable ? Object.keys(stats.byTable) : []));

  return (
    <div className="app-page app-page-shell animate-fade-in">
      <PageHeader
        icon={Shield}
        eyebrow="Administración"
        title="Registro de Auditoría"
        description="Historial de operaciones y cambios realizados en el sistema"
        accent="secondary"
      >
        <Button
          variant="outline-primary"
          onClick={() => {
            void (async () => {
              const { exportAuditLogsExcel } = await import('@/lib/utils/excelListExports');
              await exportAuditLogsExcel(logs);
            })();
          }}
          disabled={logs.length === 0 || loading}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar Excel
        </Button>
      </PageHeader>

      {stats && (
        <div className="app-kpi-grid">
          <StaffKpiStat
            label="Total operaciones"
            value={stats.totalOperations}
            hint="Últimos 7 días"
            icon={Shield}
            tone="primary"
          />
          <StaffKpiStat
            label="Inserciones"
            value={stats.inserts}
            hint="INSERT"
            icon={Plus}
            tone="success"
          />
          <StaffKpiStat
            label="Actualizaciones"
            value={stats.updates}
            hint="UPDATE"
            icon={Pencil}
            tone="info"
          />
          <StaffKpiStat
            label="Eliminaciones"
            value={stats.deletes}
            hint="DELETE"
            icon={Trash2}
            tone="warning"
          />
        </div>
      )}

      <StaffToolbar title="Filtrar registros" description="Módulo, tipo de acción y rango de fechas">
          <div className="grid grid-cols-1 gap-4 sm:col-span-2 lg:col-span-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Tabla</Label>
              <Select value={selectedTable} onValueChange={(value) => {
                setSelectedTable(value === 'all' ? '' : value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las tablas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las tablas</SelectItem>
                  {uniqueTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {tableLabel(table)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Operación</Label>
              <Select value={selectedOperation} onValueChange={(value) => {
                setSelectedOperation(value === 'all' ? '' : value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las operaciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:col-span-2 lg:col-span-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70 bg-muted/20 shadow-none">
              <CardContent className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs text-muted-foreground">Esta página</span>
                <span className="shrink-0 text-sm font-semibold">{logs.length} registros</span>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-green-50/55 shadow-none dark:bg-green-950/20">
              <CardContent className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs text-muted-foreground">Creaciones</span>
                <span className="shrink-0 text-sm font-semibold">{pageOperationCounts.inserts}</span>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-blue-50/55 shadow-none dark:bg-blue-950/20">
              <CardContent className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs text-muted-foreground">Actualizaciones</span>
                <span className="shrink-0 text-sm font-semibold">{pageOperationCounts.updates}</span>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-red-50/55 shadow-none dark:bg-red-950/20">
              <CardContent className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs text-muted-foreground">Eliminaciones</span>
                <span className="shrink-0 text-sm font-semibold">{pageOperationCounts.deletes}</span>
              </CardContent>
            </Card>
          </div>
          <div className="mt-1 sm:col-span-2 lg:col-span-4">
            <div className="flex items-end">
              <Button 
                onClick={() => {
                  setSelectedTable('');
                  setSelectedOperation('');
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
                variant="outline"
                className="w-full md:w-auto"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title="Registros de auditoría"
          description={`${total} resultados · página ${currentPage} de ${totalPages || 1}`}
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {!loading && logs.length === 0 ? (
            <StaffEmptyState
              icon={Shield}
              title="Sin registros"
              description="No hay entradas con los filtros actuales"
            />
          ) : (
          <div className="app-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">ID</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Qué pasó</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No se encontraron registros
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono">{log.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tableLabel(log.table)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={getOperationColor(log.operation)}>
                            {OPERATION_LABELS[log.operation]}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {summarizeLog(log, getChangeRows(log).length)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <p className="font-medium">
                            {log.userId ? `Usuario #${log.userId}` : 'Sistema'}
                          </p>
                          {log.ipAddress && (
                            <p className="text-muted-foreground font-mono">{log.ipAddress}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {new Date(log.timestamp).toLocaleString('es-ES')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Ver Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </StaffDataPanel>

      {/* Detail Dialog */}
      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-4xl">
          {selectedLog ? (
            <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Detalles del Log #{selectedLog.id}
            </DialogTitle>
            <CardDescription>
              {tableLabel(selectedLog.table)} · {OPERATION_LABELS[selectedLog.operation]}
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-border/70 shadow-none">
                <CardContent className="px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Responsable</p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {selectedLog.userId ? `Usuario #${selectedLog.userId}` : 'Sistema'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-none">
                <CardContent className="px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fecha y hora</p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                    <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                    {new Date(selectedLog.timestamp).toLocaleString('es-ES')}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-none">
                <CardContent className="px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Registro afectado</p>
                  <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    {selectedLog.recordId ? `#${selectedLog.recordId}` : 'Sin referencia'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div>
              <Label className="text-sm font-semibold">Resumen en lenguaje simple</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedLog.actionDescription || summarizeLog(selectedLog, selectedLogChanges.length)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {OPERATION_SHORT_HINT[selectedLog.operation]}
              </p>
            </div>

            {selectedLogChanges.length > 0 && (
              <div>
                <Label className="text-sm font-semibold">Cambios detectados</Label>
                <div className="mt-1 rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campo</TableHead>
                        <TableHead>Antes</TableHead>
                        <TableHead>Después</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedLogChanges.slice(0, 20).map((change) => (
                        <TableRow key={`${change.field}-${change.before}-${change.after}`}>
                          <TableCell className="font-medium">{change.field}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{change.before}</TableCell>
                          <TableCell className="text-xs">{change.after}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {selectedLogChanges.length > 20 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mostrando 20 de {selectedLogChanges.length} cambios para mantener la lectura simple.
                  </p>
                )}
              </div>
            )}

            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Ver JSON técnico completo
              </summary>
              <div className="mt-3 space-y-3">
                {selectedLog.previousData && (
                  <div>
                    <Label className="text-xs font-semibold">Datos anteriores (JSON)</Label>
                    <ScrollArea className="h-[180px] w-full rounded-md border p-3 mt-1">
                      <pre className="text-[11px] font-mono">
                        {JSON.stringify(selectedLog.previousData, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
                {selectedLog.newData && (
                  <div>
                    <Label className="text-xs font-semibold">Datos nuevos (JSON)</Label>
                    <ScrollArea className="h-[180px] w-full rounded-md border p-3 mt-1">
                      <pre className="text-[11px] font-mono">
                        {JSON.stringify(selectedLog.newData, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </details>
          </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
