import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { StudentPhoto } from '@/components/shared/StudentPhoto';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Eye,
  Edit,
  UserPlus,
  Download,
  Loader2,
  Upload,
  Trash2,
  Users,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  StaffKpiStat,
  StaffToolbar,
  StaffDataPanel,
  StaffDataPanelHeader,
  StaffEmptyState,
} from '@/components/staff';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageLoader } from '@/components/ui/page-loader';
import { ReincidenceBadge } from '@/components/shared/ReincidenceBadge';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { studentsService } from '@/lib/services';
import { prefetchSignedProfilePhotos } from '@/lib/utils/profilePhoto';
import { Student, EducationalLevel } from '@/types';
import { useStudentsQuery, useInvalidateStudents, STUDENTS_PAGE_SIZE } from '@/hooks/queries/useStudentsQuery';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

import { CLASSROOM_GRADES, CLASSROOM_SECTIONS } from '@/lib/constants/classrooms';

const EDUCATIONAL_LEVELS: EducationalLevel[] = ['Primaria', 'Secundaria'];

const studentFormSchema = z.object({
  codigo_barras: z.string()
    .min(1, 'El código de barras es requerido')
    .max(20, 'Máximo 20 caracteres'),
  nombre_completo: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(150, 'Máximo 150 caracteres'),
  grado: z.string().min(1, 'El grado es requerido'),
  seccion: z.string().min(1, 'La sección es requerida'),
  nivel_educativo: z.enum(['Primaria', 'Secundaria'], {
    required_error: 'El nivel educativo es requerido',
  }),
  // Campos de contacto familiar (opcionales)
  telefono_contacto: z.string().optional(),
  email_contacto: z.string().email('Email inválido').optional().or(z.literal('')),
  nombre_responsable: z.string().optional(),
  parentesco_responsable: z.string().optional(),
  telefono_emergencia: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

export const StudentsList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | EducationalLevel>('all');
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all');
  const [sectionFilter, setSectionFilter] = useState<'all' | string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const invalidateStudents = useInvalidateStudents();

  // Estados temporales para Select dentro del Dialog
  const [tempGrado, setTempGrado] = useState<string>('');
  const [tempSeccion, setTempSeccion] = useState<string>('');
  const [tempNivel, setTempNivel] = useState<EducationalLevel | ''>('');

  const studentFormDefaults: StudentFormValues = {
    codigo_barras: '',
    nombre_completo: '',
    grado: '',
    seccion: '',
    nivel_educativo: 'Secundaria',
    telefono_contacto: '',
    email_contacto: '',
    nombre_responsable: '',
    parentesco_responsable: '',
    telefono_emergencia: '',
  };

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: studentFormDefaults,
  });

  // Resetear formulario cuando se abre el dialog de creación
  useEffect(() => {
    if (dialogOpen) {
      form.reset(studentFormDefaults);
      setTempGrado('');
      setTempSeccion('');
      setTempNivel('');
      setPhotoFile(null);
      setPhotoPreview('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, levelFilter, gradeFilter, sectionFilter]);

  const studentFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      level: levelFilter === 'all' ? undefined : levelFilter,
      grade: gradeFilter === 'all' ? undefined : gradeFilter,
      section: sectionFilter === 'all' ? undefined : sectionFilter,
      page: currentPage,
    }),
    [debouncedSearch, levelFilter, gradeFilter, sectionFilter, currentPage]
  );

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useStudentsQuery(studentFilters);

  const students = data?.students ?? [];
  const totalStudents = data?.total ?? 0;
  const serverStats = data?.stats;
  const totalPages = Math.max(1, Math.ceil(totalStudents / STUDENTS_PAGE_SIZE));

  useEffect(() => {
    if (students.length > 0) {
      void prefetchSignedProfilePhotos(students.map((s) => s.profilePhoto));
    }
  }, [students]);

  useEffect(() => {
    if (isError) {
      toast.error('Error al cargar estudiantes');
    }
  }, [isError]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const filteredStudents = students;

  const uploadProfilePhoto = async (file: File): Promise<string | null> => {
    const { url, error } = await studentsService.uploadProfilePhoto(file);
    if (error) {
      console.error('Error al subir foto:', error);
      return null;
    }
    return url;
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      toast.error('Solo se permiten archivos JPG o PNG');
      return;
    }

    if (file.size > 5242880) {
      toast.error('El archivo no puede superar los 5MB');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: StudentFormValues) => {
    if (!isMountedRef.current) return;

    setIsSubmitting(true);

    try {
      let photoUrl: string | undefined = undefined;
      if (photoFile) {
        if (!isMountedRef.current) return;
        setUploadingPhoto(true);
        photoUrl = await uploadProfilePhoto(photoFile) || undefined;
        if (!isMountedRef.current) return;
        setUploadingPhoto(false);
      }

      const { student, error } = await studentsService.create({
        codigo_barras: data.codigo_barras,
        nombre_completo: data.nombre_completo,
        grado: data.grado,
        seccion: data.seccion,
        nivel_educativo: data.nivel_educativo as EducationalLevel,
        foto_perfil: photoUrl,
        telefono_contacto: data.telefono_contacto || undefined,
        email_contacto: data.email_contacto || undefined,
        nombre_responsable: data.nombre_responsable || undefined,
        parentesco_responsable: data.parentesco_responsable || undefined,
        telefono_emergencia: data.telefono_emergencia || undefined,
      });
      
      if (!isMountedRef.current) return;
      
      if (error) {
        toast.error(error);
      } else {
        toast.success('Estudiante agregado exitosamente');
        setDialogOpen(false);
        form.reset();
        setPhotoFile(null);
        setPhotoPreview('');
        setTempNivel('');
        invalidateStudents();
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en onSubmit:', error);
      toast.error('Error al crear estudiante');
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleViewStudent = async (student: Student) => {
    setSelectedStudent(student);
    setViewDialogOpen(true);
  };

  const handleEditStudent = async (student: Student) => {
    setSelectedStudent(student);
    form.reset({
      codigo_barras: student.barcode,
      nombre_completo: student.fullName,
      grado: student.grade,
      seccion: student.section,
      nivel_educativo: student.level,
      telefono_contacto: student.contactPhone || '',
      email_contacto: student.contactEmail || '',
      nombre_responsable: student.responsibleName || '',
      parentesco_responsable: student.responsibleRelationship || '',
      telefono_emergencia: student.emergencyPhone || '',
    });
    setTempGrado(student.grade);
    setTempSeccion(student.section);
    setTempNivel(student.level);
    setPhotoPreview(student.profilePhoto || '');
    setEditDialogOpen(true);
  };

  const onEditSubmit = async (data: StudentFormValues) => {
    if (!selectedStudent || !isMountedRef.current) return;

    setIsSubmitting(true);

    try {
      let photoUrl: string | undefined = selectedStudent.profilePhoto;
      if (photoFile) {
        if (!isMountedRef.current) return;
        setUploadingPhoto(true);
        const newPhotoUrl = await uploadProfilePhoto(photoFile);
        if (!isMountedRef.current) return;
        if (newPhotoUrl) photoUrl = newPhotoUrl;
        setUploadingPhoto(false);
      }

      const { success, error } = await studentsService.update(selectedStudent.id, {
        nombre_completo: data.nombre_completo,
        grado: data.grado,
        seccion: data.seccion,
        nivel_educativo: data.nivel_educativo as EducationalLevel,
        foto_perfil: photoUrl,
        telefono_contacto: data.telefono_contacto || undefined,
        email_contacto: data.email_contacto || undefined,
        nombre_responsable: data.nombre_responsable || undefined,
        parentesco_responsable: data.parentesco_responsable || undefined,
        telefono_emergencia: data.telefono_emergencia || undefined,
      });
      
      if (!isMountedRef.current) return;
      
      if (error) {
        toast.error(error);
      } else {
        toast.success('Estudiante actualizado exitosamente');
        setEditDialogOpen(false);
        setSelectedStudent(null);
        form.reset();
        setPhotoFile(null);
        setPhotoPreview('');
        setTempNivel('');
        invalidateStudents();
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Error en onEditSubmit:', error);
      toast.error('Error al actualizar estudiante');
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleExportExcel = async () => {
    const filterParts: string[] = [];
    if (levelFilter !== 'all') filterParts.push(`Nivel: ${levelFilter}`);
    if (gradeFilter !== 'all') filterParts.push(`Grado: ${gradeFilter}`);
    if (sectionFilter !== 'all') filterParts.push(`Sección: ${sectionFilter}`);
    if (searchTerm) filterParts.push(`Búsqueda: ${searchTerm}`);
    const filters = filterParts.length > 0 ? filterParts.join(' · ') : undefined;
    const { students: allRows, error } = await studentsService.getAll({
      active: true,
      fetchAll: true,
      search: debouncedSearch || undefined,
      level: levelFilter === 'all' ? undefined : levelFilter,
      grade: gradeFilter === 'all' ? undefined : gradeFilter,
      section: sectionFilter === 'all' ? undefined : sectionFilter,
    });
    if (error) {
      toast.error(error);
      return;
    }
    const { exportStudentsListExcel } = await import('@/lib/utils/excelListExports');
    void exportStudentsListExcel(allRows, filters);
  };

  const stats = {
    total: totalStudents,
    sinIncidencias: serverStats?.sinIncidencias ?? 0,
    nivelModerado: serverStats?.nivelModerado ?? 0,
    nivelAlto: serverStats?.nivelAlto ?? 0,
  };

  if (isLoading && students.length === 0) {
    return <PageLoader message="Cargando estudiantes..." />;
  }

  return (
    <div className="app-page app-page-shell">
      <PageHeader
        icon={Users}
        eyebrow="Estudiantes"
        title="Padrón de Estudiantes"
        description="Administre datos del alumno, contacto familiar y nivel de reincidencia"
        accent="info"
      >
        <div className="flex gap-2">
          <Button
            variant="outline-primary"
            onClick={handleExportExcel}
            disabled={totalStudents === 0}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Dialog 
            open={dialogOpen} 
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                // Resetear el formulario cuando se cierra el dialog
                form.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="info">
                <UserPlus className="w-4 h-4 mr-2" />
                Nuevo Estudiante
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Agregar Nuevo Estudiante</DialogTitle>
                <DialogDescription>
                  Complete la información del estudiante. Todos los campos son obligatorios.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="codigo_barras"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Barras</FormLabel>
                        <FormControl>
                          <Input placeholder="000000000000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nombre_completo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan Pérez García" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nivel_educativo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nivel Educativo</FormLabel>
                        <Select
                          value={tempNivel || undefined}
                          onValueChange={(value) => {
                            setTempNivel(value as EducationalLevel);
                            field.onChange(value);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar nivel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EDUCATIONAL_LEVELS.map((level) => (
                              <SelectItem key={level} value={level}>
                                {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="grado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grado</FormLabel>
                          <Select 
                            value={tempGrado || undefined}
                            onValueChange={(value) => {
                              setTempGrado(value);
                              field.onChange(value);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar grado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1ro">1ro</SelectItem>
                              <SelectItem value="2do">2do</SelectItem>
                              <SelectItem value="3ro">3ro</SelectItem>
                              <SelectItem value="4to">4to</SelectItem>
                              <SelectItem value="5to">5to</SelectItem>
                              <SelectItem value="6to">6to</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="seccion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sección</FormLabel>
                          <Select 
                            value={tempSeccion || undefined}
                            onValueChange={(value) => {
                              setTempSeccion(value);
                              field.onChange(value);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar sección" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="B">B</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="D">D</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <FormLabel>Foto de Perfil (Opcional)</FormLabel>
                    <div className="flex items-center gap-4">
                      {photoPreview && (
                        <Avatar className="w-20 h-20">
                          <AvatarImage src={photoPreview} alt="Preview" />
                          <AvatarFallback>IMG</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handlePhotoChange}
                          accept="image/jpeg,image/png"
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingPhoto ? 'Subiendo...' : 'Seleccionar Foto'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          JPG o PNG, máx. 5MB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Información de Contacto Familiar */}
                  <div className="border-t pt-4 space-y-4">
                    <h3 className="text-lg font-semibold">Información de Contacto Familiar</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="telefono_contacto"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono de Contacto</FormLabel>
                            <FormControl>
                              <Input placeholder="987654321" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email_contacto"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email de Contacto</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="padre@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nombre_responsable"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del Responsable</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre completo del padre/madre" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="parentesco_responsable"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parentesco</FormLabel>
                            <FormControl>
                              <Input placeholder="Padre, Madre, Apoderado, etc." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="telefono_emergencia"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Teléfono de Emergencia</FormLabel>
                            <FormControl>
                              <Input placeholder="987654321" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="success" disabled={isSubmitting || uploadingPhoto}>
                      {isSubmitting ? (
                        <span className="flex items-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Guardando...
                        </span>
                      ) : (
                        'Guardar Estudiante'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* View Student Dialog */}
          <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalles del Estudiante</DialogTitle>
              </DialogHeader>
              {selectedStudent && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <StudentPhoto
                      src={selectedStudent.profilePhoto}
                      name={selectedStudent.fullName}
                      className="w-24 h-24 shrink-0"
                    />
                    <div>
                      <h3 className="text-2xl font-bold">{selectedStudent.fullName}</h3>
                      <p className="text-muted-foreground">Código: {selectedStudent.barcode}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Nivel / Grado</Label>
                      <p className="text-lg font-semibold">
                        {selectedStudent.level} • {selectedStudent.grade}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Sección</Label>
                      <p className="text-lg font-semibold">{selectedStudent.section}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Faltas (60 días)</Label>
                      <p className="text-lg font-semibold">{selectedStudent.faultsLast60Days || 0}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Nivel de Reincidencia</Label>
                      <div className="mt-1">
                        <ReincidenceBadge level={selectedStudent.reincidenceLevel || 0} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Estado</Label>
                      <div className="mt-1">
                        <Badge variant={selectedStudent.active ? 'default' : 'secondary'}>
                          {selectedStudent.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Teléfono padre / apoderado</Label>
                      <p className="text-lg font-semibold font-mono">
                        {selectedStudent.contactPhone || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setViewDialogOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Student Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setSelectedStudent(null);
              setPhotoFile(null);
              setPhotoPreview('');
              setTempGrado('');
              setTempSeccion('');
              setTempNivel('');
              form.reset(studentFormDefaults);
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Estudiante</DialogTitle>
                <DialogDescription>
                  Modifique la información del estudiante.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="codigo_barras"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Barras</FormLabel>
                        <FormControl>
                          <Input {...field} disabled />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nombre_completo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan Pérez García" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nivel_educativo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nivel Educativo</FormLabel>
                        <Select
                          value={tempNivel || undefined}
                          onValueChange={(value) => {
                            setTempNivel(value as EducationalLevel);
                            field.onChange(value);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar nivel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EDUCATIONAL_LEVELS.map((level) => (
                              <SelectItem key={level} value={level}>
                                {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="grado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grado</FormLabel>
                          <Select 
                            value={tempGrado || undefined}
                            onValueChange={(value) => {
                              setTempGrado(value);
                              field.onChange(value);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar grado" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1ro">1ro</SelectItem>
                              <SelectItem value="2do">2do</SelectItem>
                              <SelectItem value="3ro">3ro</SelectItem>
                              <SelectItem value="4to">4to</SelectItem>
                              <SelectItem value="5to">5to</SelectItem>
                              <SelectItem value="6to">6to</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="seccion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sección</FormLabel>
                          <Select 
                            value={tempSeccion || undefined}
                            onValueChange={(value) => {
                              setTempSeccion(value);
                              field.onChange(value);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar sección" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="A">A</SelectItem>
                              <SelectItem value="B">B</SelectItem>
                              <SelectItem value="C">C</SelectItem>
                              <SelectItem value="D">D</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <FormLabel>Foto de Perfil</FormLabel>
                    <div className="flex items-center gap-4">
                      {photoPreview ? (
                        <Avatar className="w-20 h-20">
                          <AvatarImage src={photoPreview} alt="Preview" />
                          <AvatarFallback>IMG</AvatarFallback>
                        </Avatar>
                      ) : (
                        <StudentPhoto
                          src={selectedStudent?.profilePhoto}
                          name={selectedStudent?.fullName ?? ''}
                          className="w-20 h-20 shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handlePhotoChange}
                          accept="image/jpeg,image/png"
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingPhoto ? 'Subiendo...' : 'Cambiar Foto'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          JPG o PNG, máx. 5MB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contacto familiar — usado para WhatsApp de llegada */}
                  <div className="border-t pt-4 space-y-4">
                    <h3 className="text-lg font-semibold">Contacto del padre / apoderado</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="telefono_contacto"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Teléfono del padre / apoderado</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                inputMode="tel"
                                placeholder="Ej. 987654321"
                                autoComplete="tel"
                                {...field}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Número para avisos de llegada por WhatsApp
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nombre_responsable"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del responsable</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre completo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="parentesco_responsable"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parentesco</FormLabel>
                            <FormControl>
                              <Input placeholder="Padre, Madre, Apoderado…" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email_contacto"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email de contacto</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="padre@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="telefono_emergencia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono de emergencia</FormLabel>
                            <FormControl>
                              <Input type="tel" inputMode="tel" placeholder="987654321" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="success" disabled={isSubmitting || uploadingPhoto}>
                      {isSubmitting ? (
                        <span className="flex items-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Actualizando...
                        </span>
                      ) : (
                        'Guardar Cambios'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <div className="app-kpi-grid !grid-cols-2 sm:!grid-cols-4">
        <StaffKpiStat
          label="En listado"
          value={stats.total}
          hint="Activos que coinciden con el filtro"
          icon={Users}
          tone="info"
        />
        <StaffKpiStat
          label="Sin incidencias"
          value={stats.sinIncidencias}
          hint="Reincidencia nivel 0"
          hintIcon={CheckCircle2}
          icon={CheckCircle2}
          tone="success"
        />
        <StaffKpiStat
          label="Nivel moderado"
          value={stats.nivelModerado}
          hint="Reincidencia 1–2"
          hintIcon={AlertCircle}
          icon={AlertCircle}
          tone="warning"
        />
        <StaffKpiStat
          label="Nivel alto"
          value={stats.nivelAlto}
          hint="Reincidencia ≥ 3"
          hintIcon={AlertTriangle}
          icon={AlertTriangle}
          tone="accent"
        />
      </div>

      <StaffToolbar title="Buscar y filtrar" description="Refine por nombre, código, nivel, grado o sección">
        <div className="col-span-full space-y-2">
          <Label htmlFor="students-search">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="students-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nombre, código de barras o grado..."
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Nivel educativo</Label>
          <Select
            value={levelFilter}
            onValueChange={(value) => setLevelFilter(value as 'all' | EducationalLevel)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nivel educativo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los niveles</SelectItem>
              {EDUCATIONAL_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Grado</Label>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {CLASSROOM_GRADES.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sección</Label>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CLASSROOM_SECTIONS.map((section) => (
                <SelectItem key={section} value={section}>
                  {section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => refetch()} className="w-full" disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </StaffToolbar>

      <StaffDataPanel>
        <StaffDataPanelHeader
          title={`Estudiantes (${totalStudents})`}
          description={
            totalStudents > STUDENTS_PAGE_SIZE
              ? `Página ${currentPage} de ${totalPages} · ${STUDENTS_PAGE_SIZE} por página`
              : 'Datos del alumno, contacto familiar y nivel de reincidencia'
          }
        />
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          {filteredStudents.length === 0 ? (
            <StaffEmptyState
              icon={Users}
              title="No se encontraron estudiantes"
              description="Prueba otro término de búsqueda o cambia los filtros de nivel, grado o sección"
            />
          ) : (
            <>
            <div className="app-table-wrap">
            <Table role="table" aria-label="Lista de estudiantes">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Código</TableHead>
                  <TableHead scope="col">Nombre</TableHead>
                  <TableHead scope="col">Nivel / Grado</TableHead>
                  <TableHead scope="col">Sección</TableHead>
                  <TableHead scope="col">Faltas (60d)</TableHead>
                  <TableHead scope="col">Nivel Reincidencia</TableHead>
                  <TableHead scope="col">Estado</TableHead>
                  <TableHead scope="col">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow 
                    key={student.id}
                    role="row"
                    aria-label={`Estudiante ${student.fullName}`}
                  >
                    <TableCell className="font-mono text-sm">{student.barcode}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <StudentPhoto
                          src={student.profilePhoto}
                          name={student.fullName}
                          className="h-9 w-9 shrink-0"
                        />
                        <div>
                          <p className="font-medium">{student.fullName}</p>
                          <p className="text-xs text-muted-foreground">{student.barcode}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="font-semibold">{student.level}</span>
                        <span className="text-muted-foreground">{student.grade}</span>
                      </div>
                    </TableCell>
                    <TableCell>{student.section}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.faultsLast60Days || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <ReincidenceBadge level={student.reincidenceLevel || 0} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.active ? 'default' : 'secondary'}>
                        {student.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewStudent(student)}
                          aria-label={`Ver detalles de ${student.fullName}`}
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditStudent(student)}
                          aria-label={`Editar ${student.fullName}`}
                          title="Editar estudiante"
                        >
                          <Edit className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            {totalStudents > STUDENTS_PAGE_SIZE && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage((p) => Math.max(1, p - 1));
                      }}
                      className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1
                    )
                    .map((page, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev !== undefined && page - prev > 1;
                      return (
                        <span key={page} className="contents">
                          {showEllipsis && (
                            <PaginationItem>
                              <span className="px-2 text-muted-foreground">…</span>
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={page === currentPage}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page);
                              }}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </span>
                      );
                    })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage((p) => Math.min(totalPages, p + 1));
                      }}
                      className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
            </>
          )}
        </div>
      </StaffDataPanel>
    </div>
  );
};