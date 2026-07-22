"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { contractAnalysisSchema } from "@/lib/contract-schema";
import { toContractResult } from "@/lib/contract-result";
import type { AnalysisState, ContractResult } from "@/lib/contract-types";
import { validateDocumentFile } from "@/lib/document-file";
import { validateDocumentInput } from "@/lib/document-validation";
import { mockResult, sampleContract } from "@/lib/mock-contract";

export type AnalysisMode = "text" | "upload";

function getStreamErrorMessage(error: Error) {
  const message = error.message.toLowerCase();

  if (message.includes("429")) {
    return "Batas analisis tercapai. Tunggu satu menit lalu coba lagi.";
  }

  if (message.includes("503")) {
    return "Layanan AI belum dikonfigurasi. Tambahkan OPENROUTER_API_KEY untuk mengaktifkannya.";
  }

  return "Terjadi kendala saat menghubungi layanan AI. Silakan coba lagi.";
}

export function useContractAnalyzer() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<AnalysisState>("empty");
  const [analysisStep, setAnalysisStep] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<ContractResult>(mockResult);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const { object: streamedAnalysis, submit, stop } = useObject({
    api: "/api/analyze",
    schema: contractAnalysisSchema,
    onFinish({ object, error }) {
      clearProgress();

      if (error || !object) {
        setState("error");
        setFeedback("Hasil AI tidak lolos validasi terstruktur. Silakan coba kembali.");
        return;
      }

      const parsed = contractAnalysisSchema.safeParse(object);
      if (!parsed.success) {
        setState("error");
        setFeedback("Format hasil analisis tidak konsisten. Tidak ada hasil yang ditampilkan.");
        return;
      }

      if (!parsed.data.isValidDocument) {
        setState("invalid");
        setFeedback(parsed.data.alasanPenolakan ?? "Input ini bukan kontrak atau invoice yang dapat dianalisis.");
        return;
      }

      setResult(toContractResult(parsed.data));
      setState("complete");
      window.setTimeout(
        () => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80,
      );
    },
    onError(error) {
      clearProgress();
      setState("error");
      setFeedback(getStreamErrorMessage(error));
    },
  });

  useEffect(() => clearProgress, [clearProgress]);

  const startProgress = useCallback(() => {
    clearProgress();
    setState("analyzing");
    setAnalysisStep(0);
    setFeedback("");

    let nextStep = 0;
    progressTimerRef.current = setInterval(() => {
      nextStep = Math.min(nextStep + 1, 3);
      setAnalysisStep(nextStep);
    }, 1_100);
  }, [clearProgress]);

  const analyze = useCallback(async (mode: AnalysisMode) => {
    let analysisText = text;

    if (mode === "upload") {
      if (!file) {
        setState("invalid");
        setFeedback("Pilih file PDF atau DOCX terlebih dahulu.");
        return;
      }

      const fileValidation = validateDocumentFile(file);
      if (!fileValidation.valid) {
        setState("invalid");
        setFeedback(fileValidation.reason);
        return;
      }

      startProgress();
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/extract", { method: "POST", body: formData });
        const payload = await response.json() as { text?: string; error?: string; warning?: string | null };
        if (!response.ok || !payload.text) {
          clearProgress();
          setState(response.status === 422 ? "invalid" : "error");
          setFeedback(payload.error ?? "Dokumen tidak dapat dibaca.");
          return;
        }
        analysisText = payload.text;
      } catch {
        clearProgress();
        setState("error");
        setFeedback("Upload gagal. Periksa koneksi lalu coba lagi.");
        return;
      }
    }

    const validation = validateDocumentInput(analysisText);
    if (!validation.valid) {
      clearProgress();
      setState("invalid");
      setFeedback(validation.reason);
      return;
    }

    if (mode === "text") startProgress();
    submit({ text: analysisText.trim() });
  }, [clearProgress, file, startProgress, submit, text]);

  const useSample = useCallback(() => {
    clearProgress();
    setText(sampleContract);
    setFile(null);
    setState("empty");
    setFeedback("");
  }, [clearProgress]);

  const reset = useCallback(() => {
    clearProgress();
    stop();
    setText("");
    setFile(null);
    setConsent(false);
    setState("empty");
    setAnalysisStep(0);
    setFeedback("");
    window.setTimeout(
      () => document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }, [clearProgress, stop]);

  const changeText = useCallback((value: string) => {
    setText(value);
    setState((current) => current === "invalid" || current === "error" || current === "complete" ? "empty" : current);
  }, []);

  const changeFile = useCallback((nextFile: File | null) => {
    setFile(nextFile);
    setState((current) => current === "analyzing" ? current : "empty");
  }, []);

  return {
    analysisStep,
    analyze,
    changeFile,
    changeText,
    consent,
    feedback,
    file,
    reset,
    result,
    setConsent,
    state,
    streamedAnalysis,
    text,
    useSample,
  };
}
