// Export functionality specific types
export interface ExportOptions {
  format: 'stl' | 'obj' | 'ply';
  scale: number;
  units: 'mm' | 'cm' | 'inches';
}

export interface PrintingValidation {
  minWallThickness: number;
  maxOverhangAngle: number;
  supportRequired: boolean;
}