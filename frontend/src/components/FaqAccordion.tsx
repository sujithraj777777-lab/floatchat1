import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    question: "What is ARGO Oceanographic Profiling Data?",
    answer:
      "ARGO is an international ocean observatory operating ~4,000 autonomous profiling floats globally. Each float dives to 2,000 meters depth every 10 days, measuring vertical profiles of sea water temperature, practical salinity, and hydrostatic pressure before surfacing to transmit data via satellite.",
  },
  {
    question: "What is Delayed-Mode (D) vs Real-Time (R) Data?",
    answer:
      "Real-Time data is transmitted immediately via satellite without full quality inspection. Delayed-Mode (D) data undergoes rigorous scientific quality control (QC v3.1) by oceanographers, including sensor drift corrections and calibration against climatology.",
  },
  {
    question: "How is the SOFAR Sound Speed Channel calculated?",
    answer:
      "Underwater acoustic velocity is computed using the Mackenzie (1981) formula. The SOFAR (Sound Fixing and Ranging) channel axis is the depth where sound speed reaches its vertical minimum (typically ~1000m). Sound waves refract towards this minimum, trapping acoustic energy for long-range transmission.",
  },
  {
    question: "What Quality Control Flags (QC) are enforced?",
    answer:
      "FloatChat enforces Argo Quality Control Manual v3.1 policies. Profiles are filtered for non-finite values, pressure inversion anomalies, and out-of-bound measurements. Only QC Flag 1 (Good Data) and QC Flag 2 (Probably Good Data) records are ingested.",
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="panel" style={{ maxWidth: "100%", marginTop: "24px" }}>
      <div style={{ marginBottom: "16px" }}>
        <span className="eyebrow">OCEANOGRAPHY KNOWLEDGE BASE</span>
        <h2 style={{ margin: "4px 0 0 0", fontSize: "18px" }}>
          Frequently Asked Scientific Questions & Data Policies
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              style={{
                background: "var(--bg-dark)",
                border: "1px solid var(--bg-card-border)",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  background: "transparent",
                  color: "var(--text-main)",
                  border: "none",
                  fontWeight: "700",
                  fontSize: "13px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <span>{faq.question}</span>
                <span style={{ color: "var(--accent-blue)", fontSize: "16px" }}>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && (
                <div style={{ padding: "0 16px 14px 16px", color: "var(--text-muted)", fontSize: "13px", lineHeight: "1.6" }}>
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
