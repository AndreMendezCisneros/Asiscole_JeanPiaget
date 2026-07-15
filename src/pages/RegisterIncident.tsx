import { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Student, FaultType } from '@/types';
import {
  Barcode,
  Search,
  AlertTriangle,
  Upload,
  Save,
  X,
  Loader2,
  FileText,
  ListChecks,
  UserCheck,
  ClipboardList,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  StaffWorkflowSteps,
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
} from '@/components/staff';
import { ReincidenceBadge } from '@/components/shared/ReincidenceBadge';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getReincidenceLevelDescription, getSuggestedAction } from '@/lib/utils/reincidenceUtils';
import { toast } from 'sonner';
import { staffNotify } from '@/lib/utils/staffNotify';
import { studentsService, incidentsService, evidenceService } from '@/lib/services';
import { authService } from '@/lib/services';
import { ErrorDialog } from '@/components/ui/error-dialog';
import { useErrorDialog } from '@/hooks/useErrorDialog';
import { useInvalidateIncidents } from '@/hooks/queries/useIncidentsQuery';
import { useInvalidateStudents } from '@/hooks/queries/useStudentsQuery';
import { useFaultsQuery } from '@/hooks/queries/useFaultsQuery';
import { queryKeys } from '@/lib/query/queryKeys';
import { useQueryClient } from '@tanstack/react-query';

export const RegisterIncident = () => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedFault, setSelectedFault] = useState<string>('');
  const [observations, setObservations] = useState('');
  const [showReincidenceAlert, setShowReincidenceAlert] = useState(false);
  const {
    data: faults = [],
    isLoading: faultsLoading,
    isError: faultsIsError,
    refetch: refetchFaults,
  } = useFaultsQuery(true);
  const faultsLoadState: 'loading' | 'ready' | 'error' | 'empty' = faultsLoading
    ? 'loading'
    : faultsIsError
      ? 'error'
      : faults.length === 0
        ? 'empty'
        : 'ready';
  const faultsError = faultsIsError ? 'No se pudo cargar el catálogo' : null;
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const { errorDialog, showError, closeError } = useErrorDialog();
  const isMountedRef = useRef(true);
  const previewUrlsRef = useRef<string[]>([]);
  const invalidateIncidents = useInvalidateIncidents();
  const invalidateStudents = useInvalidateStudents();
  const queryClient = useQueryClient();

  useEffect(() => {
    isMountedRef.current = true;
    if (faultsIsError) {
      toast.error('Error al cargar catálogo de faltas');
    }

    return () => {
      isMountedRef.current = false;
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, [faultsIsError]);

  // Búsqueda de estudiantes por nombre
  useEffect(() => {
    if (searchInput.length >= 2) {
      const searchStudents = async () => {
        if (!isMountedRef.current) return;
        setSearching(true);
        const { students, error } = await studentsService.searchByName(searchInput, 10);
        if (!isMountedRef.current) return;
        if (!error) {
          setSearchResults(students);
        }
        setSearching(false);
      };
      
      const timeoutId = setTimeout(searchStudents, 300);
      return () => clearTimeout(timeoutId);
    } else {
      if (isMountedRef.current) {
        setSearchResults([]);
      }
    }
  }, [searchInput]);

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim() || !isMountedRef.current) return;

    setLoading(true);
    try {
      const { student, error } = await studentsService.getByBarcode(barcodeInput.trim());
      
      if (!isMountedRef.current) return;
      
      if (error || !student) {
        toast.error('Código de barras no encontrado');
        setBarcodeInput('');
        setLoading(false);
        return;
      }

      setSelectedStudent(student);
      if (student.reincidenceLevel && student.reincidenceLevel >= 2) {
        setShowReincidenceAlert(true);
      }
      staffNotify.success('Estudiante encontrado', student.fullName);
      setBarcodeInput('');
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en handleBarcodeSubmit:', error);
      toast.error('Error al buscar estudiante');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleSearchSelect = async (studentId: string) => {
    if (!isMountedRef.current) return;
    
    try {
      const { student, error } = await studentsService.getById(parseInt(studentId));
      if (!isMountedRef.current) return;
      
      if (error || !student) {
        toast.error('Error al cargar estudiante');
        return;
      }
      
      setSelectedStudent(student);
      if (student.reincidenceLevel && student.reincidenceLevel >= 2) {
        setShowReincidenceAlert(true);
      }
      setSearchInput('');
      setSearchResults([]);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en handleSearchSelect:', error);
      toast.error('Error al cargar estudiante');
    }
  };

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (evidenceFiles.length + files.length > 3) {
      toast.error('Máximo 3 fotos permitidas');
      return;
    }

    const validFiles = files.filter(file => {
      if (!file.type.match(/^image\/(jpeg|png)$/)) {
        toast.error(`${file.name}: Solo se permiten archivos JPG o PNG`);
        return false;
      }
      if (file.size > 5242880) {
        toast.error(`${file.name}: El archivo no puede superar los 5MB`);
        return false;
      }
      return true;
    });

    setEvidenceFiles(prev => [...prev, ...validFiles]);

    validFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      previewUrlsRef.current.push(url);
      setEvidencePreviews(prev => [...prev, url]);
    });
  };

  const removeEvidence = (index: number) => {
    const url = evidencePreviews[index];
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current = previewUrlsRef.current.filter((u) => u !== url);
    }
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
    setEvidencePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedStudent || !selectedFault || !isMountedRef.current) {
      if (!isMountedRef.current) return;
      toast.error('Por favor complete todos los campos requeridos');
      return;
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      toast.error('Debe iniciar sesión para registrar incidencias');
      return;
    }

    setLoading(true);
    setUploadProgress(null);

    try {
      const { incident, error } = await incidentsService.create(
        {
          studentId: selectedStudent.id,
          faultTypeId: parseInt(selectedFault, 10),
          registeredBy: currentUser.id,
          observations: observations.trim() || undefined,
        },
        { minimal: true },
      );

      if (!isMountedRef.current) return;

      if (error || !incident) {
        showError(error || 'Error al registrar incidencia', 'Error al Registrar');
        setLoading(false);
        return;
      }

      if (evidenceFiles.length > 0) {
        setUploadProgress({ current: 0, total: evidenceFiles.length });
        let uploaded = 0;

        const results = await Promise.all(
          evidenceFiles.map(async (file) => {
            const result = await evidenceService.upload(incident.id, file, currentUser.id);
            uploaded += 1;
            if (isMountedRef.current) {
              setUploadProgress({ current: uploaded, total: evidenceFiles.length });
            }
            return result;
          }),
        );

        if (!isMountedRef.current) return;

        const errors = results.filter((r) => r.error);
        
        if (errors.length > 0) {
          staffNotify.warning('Guardado con advertencia', `${errors.length} de ${evidenceFiles.length} fotos no se subieron`);
        } else {
          staffNotify.success(
            '¡Incidencia registrada!',
            `Nº ${incident.id} · ${selectedStudent.fullName} · ${evidenceFiles.length} foto(s)`
          );
        }
      } else {
        staffNotify.success(
          '¡Incidencia registrada!',
          `Nº ${incident.id} · ${selectedStudent.fullName}`
        );
      }

      // Reset form
      setSelectedStudent(null);
      setSelectedFault('');
      setObservations('');
      setShowReincidenceAlert(false);
      setSearchInput('');
      setSearchResults([]);
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
      setEvidenceFiles([]);
      setEvidencePreviews([]);
      invalidateIncidents();
      invalidateStudents();
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.recentIncidents() });
    } catch (error: any) {
      if (!isMountedRef.current) return;
      showError('Error al registrar incidencia. Por favor, intente nuevamente.', 'Error al Registrar');
      console.error(error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setUploadProgress(null);
      }
    }
  };

  const groupedFaults = useMemo(() => {
    return faults.reduce((acc, fault) => {
      if (!acc[fault.category]) {
        acc[fault.category] = [];
      }
      acc[fault.category].push(fault);
      return acc;
    }, {} as Record<string, FaultType[]>);
  }, [faults]);

  const workflowStep = !selectedStudent ? 'identify' : !selectedFault ? 'fault' : 'confirm';

  const workflowStepLabel =
    workflowStep === 'identify'
      ? 'Identificar'
      : workflowStep === 'fault'
        ? 'Seleccionar falta'
        : 'Confirmar';

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={FileText}
        eyebrow="Incidencias"
        title="Registrar Incidencia"
        description="Flujo guiado: estudiante → falta → evidencia y envío"
        accent="warning"
      />

      <StaffWorkflowSteps
        currentStep={workflowStep}
        steps={[
          {
            id: 'identify',
            label: 'Identificar estudiante',
            description: 'Código de barras o búsqueda por nombre',
          },
          { id: 'fault', label: 'Seleccionar falta', description: 'Tipo y observaciones' },
          { id: 'confirm', label: 'Confirmar registro', description: 'Evidencia y guardar' },
        ]}
      />

      <div className="app-kpi-grid !grid-cols-1 sm:!grid-cols-3">
        <StaffKpiStat
          label="Paso actual"
          value={workflowStepLabel}
          hint="Flujo de registro"
          icon={ClipboardList}
          tone="warning"
        />
        <StaffKpiStat
          label="Faltas en catálogo"
          value={
            faultsLoadState === 'loading'
              ? '…'
              : faultsLoadState === 'error'
                ? 'Error'
                : faults.length
          }
          hint={
            faultsLoadState === 'error'
              ? 'No se pudo cargar'
              : faultsLoadState === 'empty'
                ? 'Catálogo vacío'
                : 'Tipos disponibles'
          }
          hintIcon={ListChecks}
          icon={ListChecks}
          tone="info"
        />
        <StaffKpiStat
          label="Estudiante"
          value={selectedStudent ? selectedStudent.fullName.split(' ')[0] : '—'}
          hint={
            selectedStudent
              ? `${selectedStudent.grade} ${selectedStudent.section}`
              : 'Sin seleccionar'
          }
          hintIcon={UserCheck}
          icon={UserCheck}
          tone={selectedStudent ? 'success' : 'secondary'}
        />
      </div>

      <StaffToolbar
        title="Identificar estudiante"
        description="Escanee el código de barras o busque por nombre"
      >
        <form onSubmit={handleBarcodeSubmit} className="flex gap-2 sm:col-span-2">
          <div className="relative flex-1 space-y-2">
            <Label htmlFor="incident-barcode">Código de barras</Label>
            <Input
              id="incident-barcode"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Escanee o ingrese el código..."
              autoFocus
              className="font-mono"
              disabled={loading}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="flex items-center">
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </span>
              )}
            </Button>
          </div>
        </form>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="incident-search">Búsqueda por nombre</Label>
          <div className="relative">
            <Input
              id="incident-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Escriba el nombre del estudiante..."
              disabled={loading}
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-lg">
                {searchResults.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => handleSearchSelect(student.id.toString())}
                    className="cursor-pointer px-4 py-2 hover:bg-accent"
                  >
                    <p className="font-medium">{student.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {student.grade} {student.section} • {student.barcode}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </StaffToolbar>

      {!selectedStudent ? (
        <StaffDataPanel>
          <StaffEmptyState
            icon={Barcode}
            title="Sin estudiante seleccionado"
            description="Escanee un código de barras o busque por nombre para continuar"
          />
        </StaffDataPanel>
      ) : (
        <>
          {showReincidenceAlert && selectedStudent.reincidenceLevel && selectedStudent.reincidenceLevel >= 2 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>¡Alerta de Reincidencia!</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Este estudiante tiene un nivel de reincidencia {selectedStudent.reincidenceLevel}.</p>
                <p className="font-semibold">Acción sugerida: {getSuggestedAction(selectedStudent.reincidenceLevel)}</p>
              </AlertDescription>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReincidenceAlert(false)}
                className="mt-2"
              >
                <span className="flex items-center">
                  <X className="w-4 h-4 mr-2" />
                  Cerrar
                </span>
              </Button>
            </Alert>
          )}

          <StaffDataPanel>
            <StaffDataPanelHeader
              accent="info"
              title="Información del estudiante"
              description={`${selectedStudent.barcode} • ${selectedStudent.grade} ${selectedStudent.section}`}
            />
            <div className="p-4 pt-0 sm:p-5 sm:pt-0">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Nombre completo</Label>
                    <p className="text-lg font-semibold">{selectedStudent.fullName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Grado</Label>
                      <p className="text-lg font-semibold">{selectedStudent.grade}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Sección</Label>
                      <p className="text-lg font-semibold">{selectedStudent.section}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground mb-2 block">Nivel de reincidencia</Label>
                    <ReincidenceBadge level={selectedStudent.reincidenceLevel || 0} className="px-4 py-2 text-lg" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {getReincidenceLevelDescription(selectedStudent.reincidenceLevel || 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Faltas últimos 60 días</Label>
                    <p className="text-2xl font-bold">{selectedStudent.faultsLast60Days || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </StaffDataPanel>

          <StaffDataPanel>
            <StaffDataPanelHeader
              accent="warning"
              title="Tipo de falta y evidencia"
              description="Seleccione la falta, agregue observaciones y evidencia opcional"
            />
            <div className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
              <div className="space-y-2">
                <Label>Seleccionar falta</Label>
                {faultsLoadState === 'loading' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Cargando faltas…
                  </div>
                )}
                {faultsLoadState === 'error' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>No se pudo cargar el catálogo</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>{faultsError ?? 'Error de conexión con el servidor.'}</p>
                      <Button type="button" size="sm" variant="outline" onClick={() => void refetchFaults()}>
                        Reintentar
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {faultsLoadState === 'empty' && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Sin faltas activas</AlertTitle>
                    <AlertDescription>
                      No hay tipos de falta en el catálogo. Un administrador debe configurarlas en
                      Catálogo de faltas.
                    </AlertDescription>
                  </Alert>
                )}
                {faultsLoadState === 'ready' && (
                  <select
                    className="w-full h-10 rounded-md border bg-background px-3 py-2 text-sm"
                    value={selectedFault}
                    onChange={(e) => setSelectedFault(e.target.value)}
                    disabled={loading}
                  >
                    <option value="" disabled>
                      Seleccione el tipo de falta…
                    </option>
                    {faults.map((fault) => (
                      <option key={fault.id} value={fault.id.toString()}>
                        {fault.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedFault && (() => {
                const fault = faults.find(f => f.id.toString() === selectedFault);
                return fault && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={fault.severity} />
                      <span className="text-sm text-muted-foreground">Categoría: {fault.category}</span>
                    </div>
                    <p className="text-sm">{fault.description || 'Sin descripción'}</p>
                    <p className="text-sm font-semibold">Puntos: {fault.points}</p>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Describa los detalles de la incidencia..."
                  rows={4}
                  maxLength={500}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {observations.length}/500 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label>Evidencia Fotográfica (Opcional)</Label>
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer block">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png"
                      onChange={handleEvidenceChange}
                      className="hidden"
                      disabled={loading || evidenceFiles.length >= 3}
                    />
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Haga clic para seleccionar hasta 3 fotos (JPG/PNG, máx. 5MB)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {evidenceFiles.length} de 3 fotos seleccionadas
                    </p>
                  </label>

                  {evidencePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      {evidencePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`Evidencia ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeEvidence(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="flex-1" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {uploadProgress
                        ? `Subiendo fotos (${uploadProgress.current}/${uploadProgress.total})…`
                        : 'Guardando incidencia…'}
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Incidencia
                    </span>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedStudent(null);
                    setSelectedFault('');
                    setObservations('');
                    setShowReincidenceAlert(false);
                  }}
                  disabled={loading}
                >
                  <span className="flex items-center">
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </span>
                </Button>
              </div>
            </div>
          </StaffDataPanel>
        </>
      )}

      {/* Diálogo de error */}
      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => !open && closeError()}
        title={errorDialog.title}
        message={errorDialog.message}
        buttonText="OK"
        variant={errorDialog.variant}
      />
    </div>
  );
};