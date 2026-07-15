/**
 * Declaraciones de tipos para librerías externas
 * Esto elimina la necesidad de usar @ts-ignore
 */

declare module 'jspdf' {
  export interface jsPDF {
    internal: {
      pageSize: {
        getWidth(): number;
        getHeight(): number;
      };
    };
    setFontSize(size: number): void;
    setFont(family: string, style?: string): void;
    setTextColor(r: number, g: number, b: number): void;
    setFillColor(r: number, g: number, b: number): void;
    text(text: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }): void;
    rect(x: number, y: number, w: number, h: number, style?: 'F' | 'S' | 'FD'): void;
    addPage(): void;
    addImage(
      imgData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): void;
    save(filename?: string): void;
  }

  export default class jsPDF {
    constructor(orientation?: 'portrait' | 'landscape', unit?: string, format?: string);
    internal: {
      pageSize: {
        getWidth(): number;
        getHeight(): number;
      };
    };
    setFontSize(size: number): void;
    setFont(family: string, style?: string): void;
    setTextColor(r: number, g: number, b: number): void;
    setFillColor(r: number, g: number, b: number): void;
    text(text: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }): void;
    rect(x: number, y: number, w: number, h: number, style?: 'F' | 'S' | 'FD'): void;
    addPage(): void;
    addImage(
      imgData: string,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number
    ): void;
    save(filename?: string): void;
  }
}

declare module 'exceljs' {
  export interface Workbook {
    addWorksheet(name?: string): Worksheet;
    xlsx: {
      writeBuffer(): Promise<ArrayBuffer>;
    };
  }

  export interface Worksheet {
    addRow(values: any[]): Row;
    mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): void;
    getRow(row: number): Row;
    addImage(image: any, options: { tl: { col: number; row: number }; ext: { width: number; height: number } }): void;
    columns: Column[];
  }

  export interface Row {
    values: any[];
    font?: { bold?: boolean; size?: number; color?: { argb: string } };
    fill?: { type: string; pattern: string; fgColor: { argb: string } };
    alignment?: { vertical: string };
    getCell(col: number): Cell;
  }

  export interface Cell {
    fill?: { type: string; pattern: string; fgColor: { argb: string } };
    font?: { color: { argb: string } };
  }

  export interface Column {
    width?: number;
  }

  export default class ExcelJS {
    static Workbook: new () => Workbook;
    constructor();
  }
}

