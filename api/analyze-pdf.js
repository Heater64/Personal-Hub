// api/analyze-pdf.js
// Procesa PDFs y extrae texto estructurado para generar preguntas

import { PDFExtract } from 'pdf.js-extract';

export default async function handler(req, res) {
    const { pdfUrl } = req.body;
    
    // 1. Descargar PDF
    const pdfBuffer = await downloadPDF(pdfUrl);
    
    // 2. Extraer texto
    const pdfExtract = new PDFExtract();
    const extracted = await pdfExtract.extractBuffer(pdfBuffer);
    
    const fullText = extracted.pages.map(p => p.content.map(c => c.str).join(' ')).join('\n');
    
    // 3. Detectar conceptos importantes (usando NLP básico o IA)
    const concepts = await extractConcepts(fullText);
    
    // 4. Generar resumen
    const summary = await generateSummaryWithAI(fullText);
    
    res.status(200).json({
        text: fullText,
        concepts: concepts,
        summary: summary,
        pageCount: extracted.pages.length
    });
}