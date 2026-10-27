const DEVICE_KEY = "atoz.deviceId";

export function currentDevice(): { id: string; kind: "desktop" | "phone" } {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id || !/^[\w-]{8,80}$/.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  const phone =
    window.matchMedia("(max-width: 820px)").matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  return { id, kind: phone ? "phone" : "desktop" };
}

export function deviceHeaders(): HeadersInit {
  return { "content-type": "application/json", "x-atoz-device": currentDevice().id };
}
