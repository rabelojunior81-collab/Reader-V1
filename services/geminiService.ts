// FIX: Import Type for responseSchema.
import { GoogleGenAI, Type } from "@google/genai";
import { Panel } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// FIX: Added a constant for the fallback to avoid repetition.
const fallbackPanel: Panel[] = [{ x: 0, y: 0, width: 100, height: 100 }];

export async function getPanelsForPage(base64Image: string, mimeType: string): Promise<Panel[]> {
  try {
    // FIX: Simplified prompt as schema enforces the output format.
    const prompt = `Identifique os painéis de leitura nesta página de quadrinhos, na ordem de leitura.`;
    
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, textPart] },
      // FIX: Added responseMimeType and responseSchema for robust JSON handling.
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Posição X inicial em porcentagem de 0 a 100." },
              y: { type: Type.NUMBER, description: "Posição Y inicial em porcentagem de 0 a 100." },
              width: { type: Type.NUMBER, description: "Largura em porcentagem de 0 a 100." },
              height: { type: Type.NUMBER, description: "Altura em porcentagem de 0 a 100." },
            },
            required: ['x', 'y', 'width', 'height'],
          }
        }
      },
    });
    
    // FIX: Removed manual JSON stripping, as the response is now guaranteed to be JSON.
    const jsonString = response.text.trim();
    
    if (!jsonString) {
      console.warn("A API Gemini retornou uma string vazia para detecção de painel.");
      return fallbackPanel;
    }

    const detectedPanels = JSON.parse(jsonString);
    
    // FIX: Improved validation to handle non-array or empty array responses.
    if (!Array.isArray(detectedPanels) || detectedPanels.length === 0) {
        console.warn("A detecção de painel não retornou um array válido ou retornou um array vazio:", detectedPanels);
        return fallbackPanel;
    }

    const validPanels = detectedPanels.filter(p => 
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        typeof p.width === 'number' &&
        typeof p.height === 'number'
    );

    return validPanels.length > 0 ? validPanels : fallbackPanel;

  } catch (error: any) {
    console.error("Erro ao detectar painéis com a API Gemini:", error);
    
    const errorString = JSON.stringify(error);
    
    if (errorString.includes("RESOURCE_EXHAUSTED") || errorString.includes("429")) {
        throw new Error("Limite de requisições atingido. A detecção de painel foi pausada. Tente novamente em alguns instantes.");
    }
    
    throw new Error("Não foi possível detectar os painéis da página.");
  }
}