const serverBase = (import.meta.env.VITE_AWAKENDRAGON_SERVER_BASE || "").replace(/\/$/, "");

function withBase(path) {
  if (!serverBase) {
    return path;
  }
  return `${serverBase}${path}`;
}

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(withBase(path), {
    headers,
    ...options,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchBootstrap() {
  return request("/api/bootstrap");
}

export async function sendChatMessage(message) {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function resetDragonState() {
  return request("/api/reset", {
    method: "POST",
  });
}

export async function submitQuizAnswer(answer) {
  return request("/api/quiz/answer", {
    method: "POST",
    body: JSON.stringify({ answer }),
  });
}

export async function teachPhotoWord({ word, imageDataUrl, fileName }) {
  return request("/api/teach-photo", {
    method: "POST",
    body: JSON.stringify({ word, imageDataUrl, fileName }),
  });
}

export async function moveSceneObject({ objectId, x, y }) {
  return request("/api/scene/object-move", {
    method: "POST",
    body: JSON.stringify({ objectId, x, y }),
  });
}

export async function toggleSleepMode() {
  return request("/api/sleep-toggle", {
    method: "POST",
  });
}

export function resolveServerAsset(path) {
  return withBase(path);
}
