const levelOrder = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof levelOrder)[number];

function normalizeLevel(
  envLevel: string | undefined,
  fallback: LogLevel
): LogLevel {
  const normalized = levelOrder.find(
    (level) => level === (envLevel || "").toLowerCase()
  );
  return normalized ?? fallback;
}

// Use LOG_LEVEL when provided; otherwise disable warnings in production.
const runtimeLevel: LogLevel = normalizeLevel(
  typeof process !== "undefined" ? process.env.LOG_LEVEL : undefined,
  typeof process !== "undefined" && process.env.NODE_ENV === "production"
    ? "error"
    : "warn"
);

function shouldLog(level: LogLevel) {
  return levelOrder.indexOf(level) >= levelOrder.indexOf(runtimeLevel);
}

type Metadata = Record<string, unknown> | undefined;

function emit(
  level: LogLevel,
  module: string,
  message: string,
  metadata?: Metadata
) {
  if (!shouldLog(level)) return;

  const payload = {
    timestamp: new Date().toISOString(),
    module,
    level,
    message,
    ...(metadata ? { metadata } : {}),
  };

  const method =
    level === "error" ? "error" : level === "warn" ? "warn" : "log";
  // eslint-disable-next-line no-console
  console[method](payload);
}

export function createLogger(module: string) {
  return {
    debug: (message: string, metadata?: Metadata) =>
      emit("debug", module, message, metadata),
    info: (message: string, metadata?: Metadata) =>
      emit("info", module, message, metadata),
    warn: (message: string, metadata?: Metadata) =>
      emit("warn", module, message, metadata),
    error: (message: string, metadata?: Metadata) =>
      emit("error", module, message, metadata),
  };
}
