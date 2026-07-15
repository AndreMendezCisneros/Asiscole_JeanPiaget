import { toast } from 'sonner';
import { PdfReportDocument } from '@/lib/utils/pdfReportBuilder';
import type jsPDF from 'jspdf';

interface ExportPDFOptions {
  title: string;
  subtitle?: string;
  filename: string;
  content: (doc: PdfReportDocument) => void;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Hook reutilizable para exportar contenido a PDF con diseño corporativo SIE.
 */
export function useExportPDF() {
  const exportToPDF = async (options: ExportPDFOptions) => {
    try {
      toast.loading('Generando PDF...', { id: 'pdf-export' });

      const doc = new PdfReportDocument(
        options.orientation ?? 'portrait',
        options.title,
        options.subtitle ?? ''
      );
      await doc.drawCoverHeader();
      options.content(doc);
      await doc.finalize(options.filename);

      toast.success('PDF generado exitosamente', { id: 'pdf-export' });
    } catch (err) {
      console.error('Error al generar PDF:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al generar PDF: ${message}`, { id: 'pdf-export' });
    }
  };

  return { exportToPDF };
}

/** Compatibilidad: acceso directo al jsPDF subyacente si hace falta */
export type { jsPDF };
