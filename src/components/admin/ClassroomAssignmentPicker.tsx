import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CLASSROOM_GRADES, CLASSROOM_LEVELS, CLASSROOM_SECTIONS } from '@/lib/constants/classrooms';
import type { DocenteClassroom, EducationalLevel } from '@/types';
import { formatClassroomLabel } from '@/lib/utils/docenteAssignments';
import { Plus, X } from 'lucide-react';

interface ClassroomAssignmentPickerProps {
  value: DocenteClassroom[];
  onChange: (classrooms: DocenteClassroom[]) => void;
  disabled?: boolean;
}

export function ClassroomAssignmentPicker({ value, onChange, disabled }: ClassroomAssignmentPickerProps) {
  const [draftLevel, setDraftLevel] = useState<EducationalLevel>('Primaria');
  const [draftGrade, setDraftGrade] = useState<string>(CLASSROOM_GRADES[0]);
  const [draftSection, setDraftSection] = useState<string>(CLASSROOM_SECTIONS[0]);

  const keySet = useMemo(
    () => new Set(value.map((c) => `${c.level}|${c.grade}|${c.section}`)),
    [value],
  );

  const addClassroom = () => {
    const key = `${draftLevel}|${draftGrade}|${draftSection}`;
    if (keySet.has(key)) return;
    onChange([...value, { level: draftLevel, grade: draftGrade, section: draftSection }]);
  };

  const removeClassroom = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Select value={draftLevel} onValueChange={(v) => setDraftLevel(v as EducationalLevel)} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Nivel" />
          </SelectTrigger>
          <SelectContent>
            {CLASSROOM_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={draftGrade} onValueChange={setDraftGrade} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Grado" />
          </SelectTrigger>
          <SelectContent>
            {CLASSROOM_GRADES.map((grade) => (
              <SelectItem key={grade} value={grade}>
                {grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={draftSection} onValueChange={setDraftSection} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Sección" />
          </SelectTrigger>
          <SelectContent>
            {CLASSROOM_SECTIONS.map((section) => (
              <SelectItem key={section} value={section}>
                {section}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="secondary" onClick={addClassroom} disabled={disabled} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Agregar salón
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin salones asignados. Agregue al menos uno.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.map((classroom, index) => (
            <Badge key={`${classroom.level}-${classroom.grade}-${classroom.section}`} variant="secondary" className="gap-1 pr-1">
              {formatClassroomLabel(classroom)}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={() => removeClassroom(index)}
                disabled={disabled}
                aria-label={`Quitar ${formatClassroomLabel(classroom)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
