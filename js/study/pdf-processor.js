// js/study/pdf-processor.js - Procesamiento de PDFs para extracción de texto

class PDFProcessor {
    constructor() {
        this.isProcessing = false;
    }
    
    async extractTextFromPDF(file) {
        if (!file || file.type !== 'application/pdf') {
            throw new Error('El archivo debe ser un PDF válido');
        }
        
        this.isProcessing = true;
        
        try {
            // Usar PDF.js (necesitas incluir la librería)
            // Añadir en el HTML: <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
            
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js no está cargado. Asegúrate de incluir la librería.');
            }
            
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            const pageTexts = [];
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                pageTexts.push(pageText);
                fullText += pageText + '\n\n';
            }
            
            // Limpiar texto (eliminar espacios extras, líneas vacías)
            fullText = this.cleanText(fullText);
            
            return {
                success: true,
                text: fullText,
                pageCount: pdf.numPages,
                pages: pageTexts
            };
            
        } catch (error) {
            console.error('Error procesando PDF:', error);
            throw new Error(`Error al procesar el PDF: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }
    
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')           // Múltiples espacios → uno
            .replace(/\n\s*\n/g, '\n\n')     // Múltiples saltos → dos
            .trim();
    }
    
    async extractConcepts(text, maxConcepts = 10) {
        // Extraer conceptos clave usando el API de IA
        try {
            const concepts = await this.callAIForConcepts(text, maxConcepts);
            return concepts;
        } catch (error) {
            console.warn('Error extrayendo conceptos con IA:', error);
            // Fallback: extraer palabras únicas y largas
            const words = text.split(/\s+/);
            const wordFrequency = {};
            words.forEach(word => {
                const cleanWord = word.toLowerCase().replace(/[^a-záéíóúñ]/g, '');
                if (cleanWord.length > 5 && !this.isStopWord(cleanWord)) {
                    wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
                }
            });
            
            const sorted = Object.entries(wordFrequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, maxConcepts)
                .map(([word]) => word);
            
            return sorted;
        }
    }
    
    async callAIForConcepts(text, maxConcepts) {
        // Llamar al endpoint de IA para extraer conceptos
        const response = await fetch('/api/extract-concepts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, maxConcepts })
        });
        
        if (!response.ok) {
            throw new Error('Error en la API');
        }
        
        const data = await response.json();
        return data.concepts || [];
    }
    
    isStopWord(word) {
        const stopWords = ['para', 'como', 'sobre', 'entre', 'durante', 'través', 'mediante', 
                          'porque', 'entonces', 'mientras', 'aunque', 'por lo tanto', 'gran', 
                          'mayor', 'primero', 'último', 'tiene', 'puede', 'debe', 'ser', 'más'];
        return stopWords.includes(word);
    }
    
    async generateQuestionsFromPDF(file, deckName, options = {}) {
        const { topic = 'general', questionCount = 10 } = options;
        
        const extraction = await this.extractTextFromPDF(file);
        if (!extraction.success) {
            throw new Error(extraction.error);
        }
        
        // Generar preguntas usando IA
        const response = await fetch('/api/generate-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: extraction.text,
                provider: 'groq'
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Crear deck con las preguntas generadas
        const deck = {
            id: Date.now().toString(),
            name: deckName,
            cards: data.cards,
            sourceType: 'pdf',
            createdAt: new Date().toISOString(),
            sourceFile: file.name,
            pageCount: extraction.pageCount,
            topic: topic
        };
        
        return deck;
    }
    
    async summarizePDF(file) {
        const extraction = await this.extractTextFromPDF(file);
        if (!extraction.success) {
            throw new Error(extraction.error);
        }
        
        // Generar resumen con IA
        const response = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: extraction.text })
        });
        
        const data = await response.json();
        
        return {
            summary: data.summary,
            keyPoints: data.keyPoints || [],
            concepts: data.concepts || [],
            pageCount: extraction.pageCount
        };
    }
}

// Exportar para usar en la página
window.PDFProcessor = PDFProcessor;