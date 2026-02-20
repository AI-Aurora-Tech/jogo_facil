
import { GoogleGenAI, Type } from "@google/genai";
import { VerificationResult } from '../types';

export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const verificationSchema = {
  type: Type.OBJECT,
  properties: {
    isValid: { type: Type.BOOLEAN, description: "Whether receipt is valid." },
    amountFound: { type: Type.NUMBER, description: "Amount found." },
    dateFound: { type: Type.STRING, description: "Date found." },
    reason: { type: Type.STRING, description: "Explanation." },
  },
  required: ["isValid", "reason"],
};

export const verifyPixReceipt = async (
  file: File,
  expectedAmount: number,
  expectedReceiverName: string
): Promise<VerificationResult> => {
  try {
    // ALWAYS initialize GoogleGenAI using process.env.API_KEY directly as per guidelines.
    // We assume process.env.API_KEY is pre-configured and valid.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const base64Data = await fileToGenerativePart(file);

    const prompt = `Analise este comprovante PIX. 
    Valor esperado: R$ ${expectedAmount}. 
    Destinatário esperado: "${expectedReceiverName}". 
    Data atual do sistema: ${new Date().toLocaleDateString('pt-BR')}.
    
    Verifique se:
    1. O valor coincide (permita pequenas variações de centavos se for o caso).
    2. O destinatário coincide com o nome da arena ou do dono.
    3. A data do comprovante é recente (hoje ou nos últimos 2 dias).
    
    Responda estritamente em JSON conforme o schema fornecido.`;

    // Use gemini-3-flash-preview for structured JSON extraction tasks.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: file.type, data: base64Data } }, 
          { text: prompt }
        ],
      },
      config: { 
        responseMimeType: "application/json", 
        responseSchema: verificationSchema 
      },
    });

    // Access .text property directly (not a method) to extract the generated string output.
    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No text output received from the model.");
    }

    return JSON.parse(textOutput.trim()) as VerificationResult;
  } catch (error) {
    console.error("AI Verification failed:", error);
    return { 
      isValid: false, 
      amountFound: null, 
      dateFound: null, 
      reason: "Erro técnico na verificação com IA." 
    };
  }
};
