"use client";
import History from "./history";
import { saveRecent } from "@/lib/history";
import { readEvents } from "@/lib/sse";
import Options from "./options";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Box,
  Search,
  Zap,
  Download,
  Heart,
  Image as ImageIcon,
  AudioLines,
  Code2,
  Video,
  Type,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import type { ModelAnalysis } from "@/lib/types";
const example = "Qwen/Qwen-Image-2.1";
export default function Runner({ initial = "" }: { initial?: string }) {
  const [progress, setProgress] = useState("");
  const [input, setInput] = useState(initial);
  const [data, setData] = useState<ModelAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  async function analyze(value: string) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    setError("");
    setData(null);
    setProgress("Analizando modelo…");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ input: value }),
        signal: c.signal,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error);
      }
      let completed = false;
      await readEvents(response, (event) => {
        const payload = JSON.parse(event.data);
        if (event.event === "error") throw new Error(payload.error);
        if (event.event === "progress") setProgress(payload.message);
        if (event.event === "snapshot") setData(payload);
        if (event.event === "space")
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  spaces: prev.spaces.map((s) =>
                    s.id === payload.id ? payload : s,
                  ),
                }
              : prev,
          );
        if (event.event === "complete") {
          completed = true;
          setData(payload);
          saveRecent(payload);
          window.history.replaceState(null, "", "/model/" + payload.model.id);
        }
      });
      if (!completed)
        throw new Error(
          "La conexión se interrumpió. Vuelve a analizar el modelo.",
        );
    } catch (e) {
      if (!c.signal.aborted)
        setError(
          e instanceof Error ? e.message : "No se pudo analizar el modelo.",
        );
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initial) void analyze(initial);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
    };
  }, [initial]);
  const TaskIcon = data
    ? ({
        image: ImageIcon,
        audio: AudioLines,
        video: Video,
        text: Type,
        code: Code2,
      }[data.model.taskIcon] ?? Box)
    : Box;
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Zap size={20} fill="currentColor" />
          </span>
          HF Runner<span className="beta">BETA</span>
        </Link>
        <div className="top-links">
          <span className="connection">
            <i />
            {data?.connected ? "Cuenta Hugging Face conectada" : "Modo anónimo"}
          </span>
          <a
            href="https://huggingface.co/docs/hub/spaces"
            target="_blank"
            rel="noreferrer"
          >
            Cómo funciona <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <span /> TU PUERTA A MODELOS OPEN SOURCE
          </div>
          <h1>
            Todo el potencial.
            <br />
            <span>Cero descargas.</span>
          </h1>
          <p>
            Usa modelos de Hugging Face sin descargarlos.
            <br />
            Pega un enlace. Encuentra dónde ejecutarlo. Crea algo increíble.
          </p>
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              void analyze(input);
            }}
          >
            <Search size={22} />
            <input
              aria-label="Enlace o ID del modelo"
              placeholder="Pega un enlace de Hugging Face…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              required
              maxLength={500}
            />
            <button className="primary" disabled={loading}>
              {loading ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <>
                  Analizar modelo <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <div className="example">
            Prueba con{" "}
            <button
              onClick={() => {
                setInput(example);
                void analyze(example);
              }}
            >
              {example}
              <ArrowUpRight size={12} />
            </button>
            <span>Sin instalaciones. Sin GPU propia.</span>
          </div>
        </section>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {loading && (
          <div className="panel loading" role="status">
            <LoaderCircle className="spin" size={20} /> {progress}
          </div>
        )}
        {data && (
          <section className="results">
            <div className="section-label">
              MODELO ENCONTRADO <span>METADATA OFICIAL DEL HUB</span>
            </div>
            <div className="model-card">
              <div className="model-heading">
                <div className="model-icon">
                  <TaskIcon size={28} />
                </div>
                <div>
                  <a
                    href={`https://huggingface.co/${data.model.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <h2>
                      {data.model.name}
                      <ArrowUpRight size={18} />
                    </h2>
                  </a>
                  <span className="muted">{data.model.author}</span>
                </div>
                <span className="badge task">{data.model.friendlyTask}</span>
              </div>
              <div className="metrics">
                <span>
                  <Download size={15} />
                  {data.model.downloads.toLocaleString("es")} descargas
                </span>
                <span>
                  <Heart size={15} />
                  {data.model.likes} likes
                </span>
                <span>Licencia: {data.model.license ?? "No especificada"}</span>
                {data.model.parameters && (
                  <span>
                    {(data.model.parameters / 1e9).toFixed(1)}B parámetros
                  </span>
                )}
                <span className="mint">
                  <ShieldCheck size={15} />
                  Ejecución local no necesaria
                </span>
              </div>
              {data.model.gated && (
                <p className="notice">
                  Este modelo requiere aceptar condiciones o solicitar acceso en
                  Hugging Face.
                </p>
              )}
              <details>
                <summary>Ver metadata y arquitectura</summary>
                <pre>
                  {JSON.stringify(
                    {
                      library: data.model.library,
                      architecture: data.model.architecture,
                      lastModified: data.model.lastModified,
                      private: data.model.private,
                      config: data.model.config,
                      cardData: data.model.cardData,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          </section>
        )}
        {data && <Options data={data} />}
        {!data && !loading && (
          <section className="intro-grid">
            <article>
              <div className="feature-icon">
                <Search size={21} />
              </div>
              <h3>Un modelo, muchas posibilidades</h3>
              <p>Descubre Spaces y APIs que ya lo ejecutan por ti.</p>
              <span>DESCUBRIMIENTO REMOTO</span>
            </article>
            <article>
              <div className="feature-icon">
                <Zap size={21} />
              </div>
              <h3>Primero, las opciones gratuitas</h3>
              <p>ZeroGPU y acceso gratuito, cuando exista evidencia.</p>
              <span>TRANSPARENCIA POR DEFECTO</span>
            </article>
            <article>
              <div className="feature-icon">
                <ShieldCheck size={21} />
              </div>
              <h3>Tu equipo se queda ligero</h3>
              <p>Sin pesos, sin dependencias de IA, sin configurar nada.</p>
              <span>100% INFRAESTRUCTURA REMOTA</span>
            </article>
          </section>
        )}
        <History
          data={data}
          onSelect={(id) => {
            setInput(id);
            void analyze(id);
          }}
        />
      </main>
      <footer>
        <span>
          <Box size={15} /> HF Runner <span className="muted">/</span> Menos
          configuración. Más creación.
        </span>
        <a href="https://huggingface.co" target="_blank" rel="noreferrer">
          Construido sobre el ecosistema Hugging Face <ArrowUpRight size={13} />
        </a>
      </footer>
    </div>
  );
}
