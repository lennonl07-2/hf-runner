"use client";
/* eslint-disable @next/next/no-img-element -- Remote result images must not go through the Next.js image proxy. */
import { useState } from "react";
import { LoaderCircle, Play, X } from "lucide-react";
import type { SpaceExecutionOption, GradioEndpoint, Json } from "@/lib/types";
import type {RemoteExecutionOption} from '@/lib/types';
import {capturePrompts,formDefaults,quotaAlternatives,type PromptDraft} from '@/lib/fallback';
interface RecoveryProps {options:RemoteExecutionOption[];connected:boolean;initialDraft:PromptDraft;onAlternative:(space:SpaceExecutionOption,draft:PromptDraft)=>void;}
export default function Executor({
  space,
  onClose,
  ...recovery
}: {
  space: SpaceExecutionOption;
  onClose: () => void;
} & RecoveryProps) {
  const [endpointName, setEndpointName] = useState(
    space.api?.endpoints.find((e) => e.compatible && e.outputs.length > 0)
      ?.apiName ??
      space.api?.endpoints[0]?.apiName ??
      "",
  );
  const endpoint = space.api?.endpoints.find((e) => e.apiName === endpointName);
  return (
    <div className="executor panel">
      <div className="executor-heading">
        <div>
          <h2>Usar {space.title}</h2>
          <p className="muted">
            Tus entradas se enviarán a este Space de terceros. HF Runner no las
            guarda.
          </p>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Cerrar ejecutor"
        >
          <X size={20} />
        </button>
      </div>
      <label className="field">
        Endpoint
        <select
          value={endpointName}
          onChange={(e) => setEndpointName(e.target.value)}
        >
          {space.api?.endpoints.map((e) => (
            <option key={e.apiName}>{e.apiName}</option>
          ))}
        </select>
      </label>
      {endpoint?.compatible ? (
        <EndpointForm key={endpointName} endpoint={endpoint} space={space} {...recovery}/>
      ) : (
        <p className="notice">
          API detectada, pero interfaz automática no disponible.
        </p>
      )}
      <details>
        <summary>Ver endpoints y parámetros</summary>
        <pre>{JSON.stringify(space.api?.endpoints, null, 2)}</pre>
      </details>
    </div>
  );
}
function EndpointForm({
  endpoint,
  space,
  options, connected, initialDraft, onAlternative,
}: {
  endpoint: GradioEndpoint;
  space: SpaceExecutionOption;
} & RecoveryProps) {
  const [values, setValues] = useState<Json[]>(
    ()=>formDefaults(endpoint,initialDraft),
  );
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quota,setQuota]=useState(false);
  const [copied,setCopied]=useState(false);
  const alternatives=quotaAlternatives(space,options);
  const [result, setResult] = useState<{ data: Json; host: string } | null>(
    null,
  );
  const set = (i: number, value: Json) =>
    setValues((prev) => prev.map((v, n) => (i === n ? value : v)));
  async function upload(index: number, file: File | undefined) {
    if (!file) return;
    setUploading((n) => n + 1);
    setError("");
    set(index, null);
    try {
      const form = new FormData();
      form.append("space_id", space.id);
      form.append("file", file);
      const response = await fetch("/api/spaces/upload", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      set(index, { upload_id: result.upload_id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de subida.");
    } finally {
      setUploading((n) => n - 1);
    }
  }
  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setQuota(false);
    setResult(null);
    try {
      const response = await fetch("/api/spaces/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          space_id: space.id,
          endpoint: endpoint.apiName,
          parameters: values,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setQuota(data.code==='QUOTA_EXCEEDED');
        throw new Error(data.error);
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ejecutar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={run}>
      <div className="form-grid">
        {endpoint.inputs.map((p, i) => (
          <label
            className={`field ${p.component === "textbox" ? "wide" : ""}`}
            key={p.name}
          >
            {p.label}
            {p.required ? " *" : ""}
            {p.component === "textbox" ? (
              <textarea
                value={String(values[i] ?? "")}
                onChange={(e) => set(i, e.target.value)}
                required={p.required}
                maxLength={20000}
              />
            ) : p.component === "checkbox" ? (
              <input
                type="checkbox"
                checked={values[i] === true}
                onChange={(e) => set(i, e.target.checked)}
              />
            ) : ["dropdown", "radio"].includes(p.component) ? (
              <select
                value={JSON.stringify(values[i])}
                onChange={(e) => set(i, JSON.parse(e.target.value))}
              >
                {p.choices.map((c, n) => (
                  <option key={n} value={JSON.stringify(c)}>
                    {String(c)}
                  </option>
                ))}
              </select>
            ) : ["number", "slider"].includes(p.component) ? (
              <>
                <input
                  type={
                    p.component === "slider" &&
                    p.minimum !== undefined &&
                    p.maximum !== undefined
                      ? "range"
                      : "number"
                  }
                  value={Number(values[i])}
                  min={p.minimum}
                  max={p.maximum}
                  step={p.step ?? "any"}
                  onChange={(e) => set(i, Number(e.target.value))}
                />
                {p.component === "slider" && <span>{String(values[i])}</span>}
              </>
            ) : (
              <>
                <input
                  type="file"
                  accept={
                    p.component === "image"
                      ? "image/png,image/jpeg,image/webp,image/gif"
                      : p.component === "audio"
                        ? "audio/*"
                        : p.component === "video"
                          ? "video/*"
                          : ".png,.jpg,.jpeg,.webp,.gif,.wav,.mp3,.ogg,.flac,.m4a,.mp4,.webm,.pdf,.txt,.csv,.json"
                  }
                  onChange={(e) => void upload(i, e.target.files?.[0])}
                  required={p.required}
                />
                <span className="muted">
                  Hasta 10 MB ·{" "}
                  {values[i] && typeof values[i] === "object"
                    ? "Archivo subido"
                    : "Se envía al Space seleccionado"}
                </span>
              </>
            )}
          </label>
        ))}
      </div>
      {space.zeroGpu === true && (
        <p className="quota">
          ZeroGPU utiliza una cuota diaria. La cola puede tardar.
        </p>
      )}
      <button className="primary" disabled={busy || uploading > 0}>
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Play size={16} />
        )}{" "}
        {uploading > 0
          ? "Subiendo archivo…"
          : busy
            ? "Ejecutando en el Space…"
            : "Ejecutar"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {quota&&<section className="quota-recovery panel" aria-label="Alternativas por cuota agotada">
        <h3>Continuar con otra opción</h3>
        <p>La cuota ZeroGPU puede estar compartida entre Spaces. Cambiar a otro ZeroGPU no la reinicia.</p>
        <p>{connected?'Puedes abrir el Space con tu cuenta de Hugging Face y comprobar su cuota disponible.':'Estás usando el acceso anónimo del servidor. Abre el Space e inicia sesión en Hugging Face para utilizar la cuota de tu propia cuenta, si tienes disponible.'}</p>
        <div className="option-actions">
          <button type="button" className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(capturePrompts(endpoint,values).prompt??'');setCopied(true);}catch{setError('No se pudo copiar. Selecciona y copia el prompt manualmente.');}}}>{copied?'Prompt copiado':'Copiar prompt'}</button>
          <a className="secondary" href={space.url} target="_blank" rel="noreferrer">Abrir en Hugging Face</a>
        </div>
        <p>El prompt no se incluye en el enlace. Al cambiar de Space se conservan los campos de prompt reconocidos; revisa los parámetros y vuelve a subir los archivos.</p>
        {alternatives.length===0?<p>No encontramos una alternativa activa sin ZeroGPU confirmado. Puedes esperar a que se renueve tu cuota o comprobar las opciones en Hugging Face.</p>:<ul className="recovery-list">{alternatives.map(option=><li key={`${option.kind}:${option.id}`}>
          <strong>{option.title}</strong>
          <p>{option.kind==='provider'?'Proveedor externo':option.zeroGpu===false?'Hardware distinto de ZeroGPU':'Hardware desconocido; podría compartir la misma cuota'} · {option.pricing==='UNKNOWN'?'Precio no confirmado':option.pricing}. Disponibilidad de inferencia no garantizada.</p>
          {option.kind==='space'&&option.mode==='EMBEDDED/API'?<button type="button" className="secondary" onClick={()=>onAlternative(option,capturePrompts(endpoint,values))}>Cambiar a {option.title}</button>:<a className="secondary" href={option.url} target="_blank" rel="noreferrer">Abrir {option.title}</a>}
        </li>)}</ul>}
        <a href="https://huggingface.co/docs/hub/spaces-zerogpu#usage-tiers" target="_blank" rel="noreferrer">Consultar cuotas de ZeroGPU ↗</a>
      </section>}
      {result && (
        <div className="output">
          <h3>Resultado</h3>
          <Result value={result.data} host={result.host} />
        </div>
      )}
    </form>
  );
}
function Result({
  value,
  host,
  depth = 0,
}: {
  value: Json;
  host: string;
  depth?: number;
}) {
  if (depth > 8) return <p>Resultado anidado; revisa el Space.</p>;
  if (Array.isArray(value))
    return (
      <>
        {value.map((v, i) => (
          <Result key={i} value={v} host={host} depth={depth + 1} />
        ))}
      </>
    );
  if (value && typeof value === "object") {
    const candidate = typeof value.url === "string" ? value.url : undefined;
    let url: URL | undefined;
    try {
      if (candidate) url = new URL(candidate);
    } catch {}
    if (url) {
      if (
        url.origin === host &&
        url.protocol === "https:" &&
        !url.username &&
        !url.password
      ) {
        const mime = typeof value.mime_type === "string" ? value.mime_type : "";
        if (
          mime.startsWith("image/") ||
          /\.(png|jpe?g|webp|gif)(?:\?|$)/i.test(url.href)
        )
          return (
            <img
              src={url.href}
              alt="Imagen generada remotamente"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          );
        if (
          mime.startsWith("audio/") ||
          /\.(wav|mp3|ogg|flac)(?:\?|$)/i.test(url.href)
        )
          return <audio src={url.href} controls />;
        if (mime.startsWith("video/") || /\.(mp4|webm)(?:\?|$)/i.test(url.href))
          return <video src={url.href} controls />;
        return (
          <a href={url.href} target="_blank" rel="noreferrer">
            Abrir archivo de resultado
          </a>
        );
      }
    }
    if (value.image || value.video || value.audio) {
      return (
        <Result
          value={value.image ?? value.video ?? value.audio}
          host={host}
          depth={depth + 1}
        />
      );
    }
    return <pre>{JSON.stringify(value, null, 2)}</pre>;
  }
  return <pre>{String(value ?? "")}</pre>;
}
