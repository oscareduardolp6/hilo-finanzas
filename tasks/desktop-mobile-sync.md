---
status: pendiente
priority: 4
---

# Sincronizar escritorio y móvil

Una vez que cada dispositivo guarde sus datos de forma independiente (ver [local-storage-migration.md](local-storage-migration.md)), el problema que sigue es que esos datos quedan aislados: lo que registras en el celular no aparece en la compu, y viceversa.

## Idea

Una forma de pasar los datos de un dispositivo a otro **sin backend por ahora** — por ejemplo:

- Código QR que codifique (o apunte a) un export de los datos, para escanearlo desde el otro dispositivo.
- Si un QR no es viable por el tamaño de los datos, un archivo exportable (JSON) que se descarga en un dispositivo y se importa en el otro.

Esto no es sincronización continua/automática, es un traspaso manual bajo demanda. Un backend real con sincronización automática entre dispositivos es la solución de fondo, pero queda para más adelante — no es prioridad ahora mismo.

## Abierto / por decidir

- Si el QR alcanza para el volumen típico de datos de un usuario o si hace falta el archivo como respaldo/alternativa desde el inicio.
- Si el traspaso es "todo o nada" (reemplaza los datos del dispositivo destino) o si intenta hacer merge con lo que ya tenía.
- Qué tan seguido se espera que alguien haga este traspaso manual — afecta qué tan fricción-tolerante puede ser el flujo.
