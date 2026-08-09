import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Wallet, Loader2, RefreshCw, MessageCircle, FileSpreadsheet, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  StaffDataPanel,
  StaffDataPanelBody,
  StaffDataPanelHeader,
  StaffEmptyState,
  StaffKpiStat,
  StaffToolbar,
} from '@/components/staff';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PensionImportPanel } from '@/components/pensiones/PensionImportPanel';
import { pensionesService, whatsappService } from '@/lib/services';
import type { PensionConfig, PensionImportLog, PensionRow } from '@/types';
import { getLimaTodayDate } from '@/lib/utils/limaDateTime';
import { periodoFromLimaDate } from '@/lib/utils/pensionPeriod';

function estadoBadge(estado: string, pagado: 0 | 1) {
  if (pagado === 1 || estado === 'pagado') {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Pagado (1)</Badge>;
  }
  if (estado === 'moroso') {
    return <Badge variant="destructive">Moroso (0)</Badge>;
  }
  return <Badge variant="secondary">Pendiente (0)</Badge>;
}

export const PensionesAdmin = () => {
  const [periodo, setPeriodo] = useState(() => periodoFromLimaDate(getLimaTodayDate()));
  const [config, setConfig] = useState<PensionConfig | null>(null);
  const [rows, setRows] = useState<PensionRow[]>([]);
  const [logs, setLogs] = useState<PensionImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('all');

  const loadAll = useCallback(async (silent?: boolean) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [cfg, list, logRes] = await Promise.all([
        pensionesService.getConfig(),
        pensionesService.listByPeriodo(periodo),
        pensionesService.listImportLogs(15),
      ]);
      if (cfg.error) toast.error(cfg.error);
      else setConfig(cfg.config);
      if (list.error) toast.error(list.error);
      else setRows(list.rows);
      if (!logRes.error) setLogs(logRes.rows);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodo]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtroEstado === 'pagado' && r.pagado !== 1) return false;
      if (filtroEstado === 'pendiente' && r.estado !== 'pendiente') return false;
      if (filtroEstado === 'moroso' && r.estado !== 'moroso') return false;
      if (filtroEstado === 'no_pagado' && r.pagado !== 0) return false;
      if (!q) return true;
      const hay = `${r.nombreEstudiante || ''} ${r.barcode || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, filtroEstado]);

  const kpis = useMemo(() => {
    const pagados = rows.filter((r) => r.pagado === 1).length;
    const morosos = rows.filter((r) => r.estado === 'moroso').length;
    const pendientes = rows.filter((r) => r.estado === 'pendiente').length;
    return { total: rows.length, pagados, morosos, pendientes };
  }, [rows]);

  const markPaid = async (row: PensionRow) => {
    const { error } = await pensionesService.updateManual({ id: row.id, pagado: 1 });
    if (error) toast.error(error);
    else {
      toast.success('Marcado como pagado');
      void loadAll(true);
    }
  };

  const notifyOne = async (row: PensionRow) => {
    if (!whatsappService.isEnabled()) {
      toast.error('WhatsApp desactivado');
      return;
    }
    const student = {
      id: row.idEstudiante,
      fullName: row.nombreEstudiante || 'Estudiante',
      grade: row.grado || '',
      section: row.seccion || '',
      level: 'Secundaria' as const,
      barcode: row.barcode || '',
      active: true,
      contactPhone: row.contactPhone,
      emergencyPhone: row.emergencyPhone,
    };
    const wa = await whatsappService.notifyParentPensionPending(student, {
      periodo: row.periodo,
      monto: row.monto ?? config?.montoMensual ?? null,
      pensionId: row.id,
    });
    if (wa.skipped) toast.info('Aviso ya enviado hace poco');
    else if (wa.ok) toast.success('WhatsApp enviado');
    else toast.error(wa.error || 'No se pudo enviar');
  };

  if (loading) return <PageLoader />;

  return (
    <div className="app-page app-page-shell space-y-6">
      <PageHeader
        icon={Wallet}
        eyebrow="Administración"
        title="Pensiones"
        description="Importación bancaria en memoria, estado por periodo y aviso en el escáner (sin bloquear asistencia)"
        accent="secondary"
      />

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat
          label="Registros"
          value={kpis.total}
          hint={periodo}
          icon={Wallet}
          tone="info"
        />
        <StaffKpiStat
          label="Pagados"
          value={kpis.pagados}
          hint="pagado=1"
          icon={CheckCircle2}
          tone="success"
        />
        <StaffKpiStat
          label="Pendientes"
          value={kpis.pendientes}
          hint="antes del vencimiento"
          icon={Clock}
          tone="warning"
        />
        <StaffKpiStat
          label="Morosos"
          value={kpis.morosos}
          hint="día siguiente al vencimiento"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <StaffToolbar>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="periodo">Periodo</Label>
            <Input
              id="periodo"
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button variant="outline" onClick={() => void loadAll(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
          <p className="text-xs text-muted-foreground max-w-sm">
            Vencimiento día {config?.diaVencimiento ?? 10}
            {config?.montoMensual != null ? ` · Monto ref. S/ ${config.montoMensual}` : ''}
            {' '}(configurable en Ajustes)
          </p>
        </div>
      </StaffToolbar>

      <Tabs defaultValue="listado">
        <TabsList>
          <TabsTrigger value="listado">Listado</TabsTrigger>
          <TabsTrigger value="importar">Importar Excel</TabsTrigger>
          <TabsTrigger value="historial">Historial import</TabsTrigger>
        </TabsList>

        <TabsContent value="importar" className="mt-4">
          <StaffDataPanel>
            <StaffDataPanelHeader
              accent="info"
              title="Importar Excel del banco"
              description="Se parsea en el navegador. El archivo nunca se sube a Storage ni se guarda en disco."
            />
            <StaffDataPanelBody>
              <PensionImportPanel
                periodo={periodo}
                diaVencimiento={config?.diaVencimiento ?? 10}
                montoMensual={config?.montoMensual ?? null}
                onImported={() => void loadAll(true)}
              />
            </StaffDataPanelBody>
          </StaffDataPanel>
        </TabsContent>

        <TabsContent value="listado" className="mt-4">
          <StaffDataPanel>
            <StaffDataPanelHeader
              title={`Periodo ${periodo}`}
              description="Al abrir se recalculan morosos (pagado=0 tras el día siguiente al vencimiento)."
            />
            <StaffDataPanelBody className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Buscar alumno o DNI…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pagado">Pagados</SelectItem>
                    <SelectItem value="no_pagado">Sin pagar (0)</SelectItem>
                    <SelectItem value="pendiente">Pendientes</SelectItem>
                    <SelectItem value="moroso">Morosos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filtered.length === 0 ? (
                <StaffEmptyState
                  icon={Wallet}
                  title="Sin registros"
                  description="Importe un Excel o cambie de periodo."
                />
              ) : (
                <div className="overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>DNI</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-medium">{row.nombreEstudiante}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.grado} {row.seccion}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row.barcode}</TableCell>
                          <TableCell>{estadoBadge(row.estado, row.pagado)}</TableCell>
                          <TableCell>
                            {row.monto != null ? `S/ ${Number(row.monto).toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell className="text-xs">{row.fechaVencimiento}</TableCell>
                          <TableCell className="text-right space-x-1">
                            {row.pagado === 0 && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => void markPaid(row)}>
                                  Marcar pagado
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => void notifyOne(row)}>
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </StaffDataPanelBody>
          </StaffDataPanel>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <StaffDataPanel>
            <StaffDataPanelHeader title="Últimas importaciones" description="Solo metadatos (nombre de archivo, conteos)." />
            <StaffDataPanelBody>
              {logs.length === 0 ? (
                <StaffEmptyState
                  icon={FileSpreadsheet}
                  title="Sin imports"
                  description="Aún no hay cargas registradas."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead>OK</TableHead>
                      <TableHead>Sin match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">{log.importadoEn}</TableCell>
                        <TableCell>{log.periodo}</TableCell>
                        <TableCell>{log.modo}</TableCell>
                        <TableCell>{log.nombreArchivo || '—'}</TableCell>
                        <TableCell>{log.filasOk}</TableCell>
                        <TableCell>{log.filasSinMatch}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </StaffDataPanelBody>
          </StaffDataPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
};
