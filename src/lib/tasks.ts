const tasks: Record<string, [string, string]> = {
  "text-generation": ["Text / LLM", "text"],
  conversational: ["Chat", "text"],
  "text-to-image": ["Image Generation", "image"],
  "image-to-image": ["Image Editing", "image"],
  "image-text-to-text": ["Vision Language Model", "image"],
  "text-to-video": ["Video Generation", "video"],
  "image-to-video": ["Image to Video", "video"],
  "automatic-speech-recognition": ["Speech Recognition", "audio"],
  "text-to-speech": ["Speech Generation", "audio"],
  "audio-to-audio": ["Audio Processing", "audio"],
  "text-classification": ["Text Classification", "text"],
  "token-classification": ["Token Classification", "text"],
  "question-answering": ["Question Answering", "text"],
  translation: ["Translation", "text"],
  summarization: ["Summarization", "text"],
  "feature-extraction": ["Embeddings", "code"],
  "sentence-similarity": ["Sentence Similarity", "text"],
  "object-detection": ["Object Detection", "image"],
  "image-classification": ["Image Classification", "image"],
  "image-segmentation": ["Image Segmentation", "image"],
  "depth-estimation": ["Depth Estimation", "image"],
  "unconditional-image-generation": ["Image Generation", "image"],
};
export function normalizeTask(tag?: string) {
  const [label, icon] = tasks[tag ?? ""] ?? [
    tag || "Tarea sin especificar",
    "code",
  ];
  return { id: tag ?? "unknown", label, icon };
}
