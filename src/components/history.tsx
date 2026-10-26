"use client";
import { useEffect, useState } from "react";
import { Star, Clock3 } from "lucide-react";
import {
  loadRecents,
  loadFavorites,
  saveFavorites,
  type RecentModel,
} from "@/lib/history";
import type { ModelAnalysis } from "@/lib/types";
export default function History({
  data,
  onSelect,
}: {
  data: ModelAnalysis | null;
  onSelect: (id: string) => void;
}) {
  const [recent, setRecent] = useState<RecentModel[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setRecent(loadRecents());
      setFavorites(loadFavorites());
    }, 0);
    return () => clearTimeout(timer);
  }, [data]);
  function toggle(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((v) => v !== id)
        : [id, ...prev].slice(0, 50);
      saveFavorites(next);
      return next;
    });
  }
  if (!recent.length && !favorites.length && !data) return null;
  return (
    <section className="history">
      <div className="history-top">
        <h3>
          <Clock3 size={15} /> Modelos recientes
        </h3>
        {data && !data.model.private && (
          <button className="text-button" onClick={() => toggle(data.model.id)}>
            <Star
              size={14}
              fill={favorites.includes(data.model.id) ? "currentColor" : "none"}
            />
            {favorites.includes(data.model.id)
              ? "Quitar favorito"
              : "Guardar favorito"}
          </button>
        )}
      </div>
      <div className="history-list">
        {recent.map((m) => (
          <button key={m.id} onClick={() => onSelect(m.id)}>
            {m.id}
            <span>{m.summary.spacesFound} Spaces</span>
          </button>
        ))}
      </div>
      {favorites.length > 0 && (
        <>
          <h3>
            <Star size={15} /> Favoritos
          </h3>
          <div className="history-list">
            {favorites.map((id) => (
              <div className="favorite" key={id}>
                <button onClick={() => onSelect(id)}>{id}</button>
                <button
                  aria-label={`Quitar ${id} de favoritos`}
                  onClick={() => toggle(id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
