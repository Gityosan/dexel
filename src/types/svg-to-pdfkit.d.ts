declare module "svg-to-pdfkit" {
  import type PDFDocument from "pdfkit";

  type Doc = InstanceType<typeof PDFDocument>;

  interface SVGtoPDFOptions {
    width?: number;
    height?: number;
    preserveAspectRatio?: string;
    assumePt?: boolean;
    [key: string]: unknown;
  }

  function SVGtoPDF(
    doc: Doc,
    svg: string,
    x?: number,
    y?: number,
    options?: SVGtoPDFOptions,
  ): void;

  export default SVGtoPDF;
}
