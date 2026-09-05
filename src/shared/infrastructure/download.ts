/* Bajar un JSON al disco del usuario. Es un `<a download>` sintético: sin
   servidor, no hay otra forma de entregar un archivo.

   `exportFileName` fecha el archivo con el reloj local a propósito — el nombre
   lo lee una persona buscando "el de ayer", no una máquina. */

export function exportFileName(kind: string, now: number = Date.now()): string {
  const d = new Date(now);
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `hilo-${kind}-${stamp}.json`;
}

export function downloadJson(payload: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
