
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
    // Acesso seguro à API_KEY para evitar ReferenceError
    const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || "";
    
    if (!apiKey) {
      return { 
        isValid: false, 
        amountFound: null, 
        dateFound: null, 
        reason: "IA indisponível no momento (Erro de Configuração)." 
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = await fileToGenerativePart(file);

    const prompt = `Analise este comprovante PIX. Valor esperado: R$ ${expectedAmount}. Destinatário: "${expectedReceiverName}". Responda em JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{ inlineData: { mimeType: file.type, data: base64Data } }, { text: prompt }],
      },
      config: { responseMimeType: "application/json", responseSchema: verificationSchema },
    });

    const textOutput = response.text;
    if (textOutput) return JSON.parse(textOutput.trim()) as VerificationResult;
    throw new Error("No response");
  } catch (error) {
    console.error("AI Verification failed:", error);
    return { isValid: false, amountFound: null, dateFound: null, reason: "Erro técnico na verificação com IA." };
  }
};
