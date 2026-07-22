"use client";

import { AppFooter } from "@/components/analyzer/app-footer";
import { AppHeader } from "@/components/analyzer/app-header";
import { Hero } from "@/components/analyzer/hero";
import { HowItWorks } from "@/components/analyzer/how-it-works";
import { InputPanel } from "@/components/analyzer/input-panel";
import { ResultsPanel } from "@/components/analyzer/results-panel";
import { useContractAnalyzer } from "@/hooks/use-contract-analyzer";

export function AnalyzerWorkspace() {
  const analyzer = useContractAnalyzer();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="app-grid pointer-events-none absolute inset-x-0 top-0 h-[920px]" />
      <div className="pointer-events-none absolute -left-40 top-40 size-[400px] rounded-full bg-violet-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-48 top-[480px] size-[430px] rounded-full bg-teal-200/20 blur-3xl" />
      <AppHeader />
      <main id="main">
        <Hero />
        <section id="analyzer" className="relative mx-auto grid max-w-[1440px] scroll-mt-24 gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)] lg:items-start lg:px-8">
          <InputPanel
            text={analyzer.text}
            onTextChange={analyzer.changeText}
            file={analyzer.file}
            onFileChange={analyzer.changeFile}
            consent={analyzer.consent}
            onConsentChange={analyzer.setConsent}
            state={analyzer.state}
            analysisStep={analyzer.analysisStep}
            feedback={analyzer.feedback}
            onAnalyze={analyzer.analyze}
            onUseSample={analyzer.useSample}
          />
          <div id="results" className="scroll-mt-24">
            <ResultsPanel
              state={analyzer.state}
              result={analyzer.result}
              streamedAnalysis={analyzer.streamedAnalysis}
              onReset={analyzer.reset}
            />
          </div>
        </section>
        <HowItWorks />
      </main>
      <AppFooter />
    </div>
  );
}
