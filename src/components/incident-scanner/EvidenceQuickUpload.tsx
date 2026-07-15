import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';

const MAX_PHOTOS = 3;

interface EvidenceQuickUploadProps {
  files: File[];
  previews: string[];
  onChange: (files: File[], previews: string[]) => void;
  disabled?: boolean;
}

export function EvidenceQuickUpload({ files, previews, onChange, disabled }: EvidenceQuickUploadProps) {
  const previewUrlsRef = useRef<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';

    if (files.length + picked.length > MAX_PHOTOS) {
      toast.error('Máximo 3 fotos permitidas');
      return;
    }

    const valid = picked.filter((file) => {
      if (!file.type.match(/^image\/(jpeg|png)$/)) {
        toast.error(`${file.name}: Solo JPG o PNG`);
        return false;
      }
      if (file.size > 5242880) {
        toast.error(`${file.name}: máximo 5MB`);
        return false;
      }
      return true;
    });

    const newPreviews = valid.map((file) => {
      const url = URL.createObjectURL(file);
      previewUrlsRef.current.push(url);
      return url;
    });

    onChange([...files, ...valid], [...previews, ...newPreviews]);
  };

  const removeAt = (index: number) => {
    const url = previews[index];
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current = previewUrlsRef.current.filter((u) => u !== url);
    }
    onChange(
      files.filter((_, i) => i !== index),
      previews.filter((_, i) => i !== index),
    );
  };

  return (
    <div className="space-y-2">
      <Label>Evidencia fotográfica (opcional)</Label>
      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-4 text-center hover:bg-muted/50 transition-colors">
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png"
          onChange={handleChange}
          className="hidden"
          disabled={disabled || files.length >= MAX_PHOTOS}
        />
        <Upload className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Hasta 3 fotos (JPG/PNG, máx. 5MB)</p>
        <p className="mt-1 text-xs text-muted-foreground">{files.length} de {MAX_PHOTOS} seleccionadas</p>
      </label>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((preview, index) => (
            <div key={preview} className="group relative">
              <img src={preview} alt={`Evidencia ${index + 1}`} className="h-24 w-full rounded-lg border object-cover" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 opacity-90"
                onClick={() => removeAt(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
