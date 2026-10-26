import type { SpaceExecutionOption } from "../types";
import { cached } from "./cache";
import { remote } from "./http";
import { enrichZeroGpu } from "../ranking";
export async function checkHealth(
  input: SpaceExecutionOption,
): Promise<SpaceExecutionOption> {
  const space = enrichZeroGpu(input);
  if (!space.host || space.disabled) return space;
  const health = await cached(`health:${space.host}`, 90_000, async () => {
    try {
      const r = await remote(`${space.host}/`, {
        method: "HEAD",
        timeout: 4000,
        maxBytes: 0,
      });
      return { httpStatus: r.status, checkedAt: new Date().toISOString() };
    } catch {
      return { httpStatus: undefined, checkedAt: new Date().toISOString() };
    }
  });
  // A sleeping or building runtime remains recoverable even when its HTTP check fails.
  const status = ["SLEEPING", "BUILDING", "STOPPED", "ERROR"].includes(
    space.status,
  )
    ? space.status
    : health.httpStatus && health.httpStatus >= 200 && health.httpStatus < 400
      ? ("RUNNING" as const)
      : health.httpStatus && health.httpStatus >= 500
        ? ("ERROR" as const)
        : ("UNKNOWN" as const);
  return {
    ...space,
    ...health,
    status,
    mode:
      status === "ERROR" || status === "STOPPED" ? "UNAVAILABLE" : "EXTERNAL",
    reasons: [
      ...space.reasons,
      health.httpStatus
        ? `La comprobación HTTP respondió ${health.httpStatus}.`
        : "No se pudo confirmar la respuesta HTTP; esto no prueba que el Space haya dejado de existir.",
    ],
  };
}
