"use client";
import Executor from "./executor";
import type {PromptDraft} from '@/lib/fallback';
import { rankOptions } from "@/lib/ranking";
import type { SpaceExecutionOption } from "@/lib/types";
import { useState } from "react";
import { ArrowUpRight, Box, Check, SlidersHorizontal, Zap } from "lucide-react";
import type { ModelAnalysis } from "@/lib/types";
const labels = {
  RUNNING: "En ejecución",
  SLEEPING: "Dormido · puede despertar",
  BUILDING: "Construyéndose",
  ERROR: "Error",
  STOPPED: "Detenido",
  UNKNOWN: "Estado desconocido",
};
export default function Options({ data }: { data: ModelAnalysis }) {
  const [selected, setSelected] = useState<SpaceExecutionOption | null>(null);
  const [draft,setDraft] = useState<PromptDraft>({});
  const [tab, setTab] = useState("Todos");
  const [weak, setWeak] = useState(false);
  const all = rankOptions([...data.spaces, ...data.providers]);
  const items = all.filter(
    (s) =>
      (weak || s.kind !== "space" || s.confidence !== "LOW") &&
      (tab === "Todos" ||
        (tab === "Gratis" && s.pricing.startsWith("FREE")) ||
        (tab === "Spaces" && s.kind === "space") ||
        (tab === "API" &&
          (s.kind === "provider" ||
            (s.kind === "space" && s.api?.apiAvailable))) ||
        (tab === "Otros" && s.kind === "space" && s.sdk !== "gradio")),
  );
  return (
    <section className="options">
      <div className="options-title">
        <div>
          <h2>
            Formas de usarlo <span className="count">{all.length}</span>
          </h2>
          <p className="muted">
            {data.spaces.filter((s) => s.status === "RUNNING").length} activos ·{" "}
            {
              data.spaces.filter(
                (s) => s.pricing.startsWith("FREE") && s.status === "RUNNING",
              ).length
            }{" "}
            con acceso gratuito limitado ·{" "}
            {data.spaces.filter((s) => s.api?.apiAvailable).length} APIs
            accesibles
          </p>
        </div>
        <span className="sort">
          <SlidersHorizontal size={14} /> Mejores opciones primero
        </span>
      </div>
      <div className="tabs">
        {["Todos", "Gratis", "Spaces", "API", "Otros"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            checked={weak}
            onChange={(e) => setWeak(e.target.checked)}
          />{" "}
          Mostrar coincidencias débiles
        </label>
      </div>
      {data.warnings.map((w) => (
        <p className="notice" key={w}>
          {w}
        </p>
      ))}
      {!items.length && (
        <div className="panel empty">
          <Box size={26} />
          <h3>
            {tab === "Gratis"
              ? "No encontramos una forma gratuita confirmada de ejecutar este modelo actualmente."
              : "No hay opciones para este filtro."}
          </h3>
          <p className="muted">
            Encontramos {data.spaces.length} Spaces relacionados. La
            disponibilidad y el coste pueden requerir comprobación.
          </p>
        </div>
      )}
      {selected && (
        <Executor
          key={selected.id}
          space={selected}
          options={all}
          connected={data.connected}
          initialDraft={draft}
          onAlternative={(next,prompts)=>{setDraft(prompts);setSelected(next);}}
          onClose={() => setSelected(null)}
        />
      )}
      <div className="options-grid">
        {items.map((s) => (
          <article className="option-card" key={`${s.kind}:${s.id}`}>
            <div className="option-heading">
              <span className="small-icon">
                {s.kind === "space" ? <Box size={20} /> : <Zap size={20} />}
              </span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.kind === "space" ? s.author : s.provider}</p>
              </div>
              {s.kind === "space" && s.official && (
                <span className="badge green">
                  <Check size={11} /> OFFICIAL
                </span>
              )}
            </div>
            <div className="badges">
              <span
                className={`badge ${s.status === "RUNNING" ? "green" : ""}`}
              >
                {labels[s.status]}
              </span>
              {s.kind === "space" && (
                <>
                  <span className="badge">{s.sdk.toUpperCase()}</span>
                  {s.zeroGpu === true && (
                    <span className="badge green">⚡ ZEROGPU</span>
                  )}
                  {s.api?.apiAvailable && (
                    <span className="badge">GRADIO API</span>
                  )}
                </>
              )}
              <span
                className={`badge ${s.pricing.startsWith("FREE") ? "green" : ""}`}
              >
                {s.pricing === "UNKNOWN" ? "Precio no confirmado" : s.pricing}
              </span>
            </div>
            <p className="option-description">{s.pricingEvidence}</p>
            {s.kind === "space" && s.zeroGpu === true && (
              <p className="quota">ZeroGPU utiliza una cuota diaria.</p>
            )}
            <details>
              <summary>¿Por qué aparece esta opción?</summary>
              <p>{s.reasons.join(" ")}</p>
              {s.kind === "space" && (
                <p>
                  Coincidencia: {s.confidence}.{" "}
                  {s.hardware && `Hardware: ${s.hardware}.`}{" "}
                  {s.checkedAt
                    ? `Comprobado: ${new Date(s.checkedAt).toLocaleTimeString("es")}`
                    : "Estado declarado por el Hub; HTTP pendiente de comprobar."}
                </p>
              )}
            </details>
            <div className="option-actions">
              {s.kind === "space" && s.api?.apiAvailable && (
                <button
                  className="secondary"
                  onClick={() => {
                    setDraft({});
                    setSelected(s);
                    setTimeout(
                      () =>
                        document
                          .querySelector(".executor")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          }),
                      0,
                    );
                  }}
                >
                  {s.mode === "EMBEDDED/API" ? "Usar aquí" : "Ver endpoints"}
                </button>
              )}
              <a
                className="secondary"
                href={s.url}
                target="_blank"
                rel="noreferrer"
              >
                {s.kind === "provider"
                  ? "Usar API en Hugging Face"
                  : "Abrir Space"}
                <ArrowUpRight size={14} />
              </a>
              {s.kind === "space" && <span className="muted">♡ {s.likes}</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
