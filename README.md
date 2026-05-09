# FemVault MVP — Solana Privacy Wallet for Fertility Data

MVP para hackathon: una paciente guarda un dato de fertilidad cifrado, da acceso temporal a un doctor y luego lo revoca. Los datos médicos NO se guardan en Solana; Solana solo guarda permisos verificables.

## Demo flow

1. Paciente conecta Phantom.
2. Guarda un dato de fertilidad.
3. Concede acceso temporal a la wallet del doctor.
4. Doctor conecta Phantom y ve el dato si el permiso está activo.
5. Paciente revoca acceso.
6. Doctor intenta entrar otra vez y recibe acceso denegado.

## Arquitectura

```txt
React + TypeScript frontend
  ├─ cifra/descifra datos con AES-GCM en el navegador
  ├─ conecta Phantom Wallet
  └─ consulta permisos

Express backend
  └─ guarda únicamente datos cifrados off-chain

Solana + Anchor program
  └─ guarda permisos: patient, doctor, recordIdHash, expiresAt, revoked
```

## Modo rápido para demo

El frontend trae `DEMO_MODE=true` por defecto. Eso simula permisos localmente para que puedan probar la demo aunque todavía no hayan desplegado Anchor.

Cuando tengan el programa desplegado, cambien:

```env
VITE_DEMO_MODE=false
VITE_SOLANA_RPC=https://api.devnet.solana.com
VITE_PROGRAM_ID=TU_PROGRAM_ID
```

## Backend

```bash
cd backend
npm install
npm run dev
```

Corre en: `http://localhost:4000`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Corre en: `http://localhost:5173`

## Anchor program

```bash
cd anchor
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

Después copien el program id en `frontend/.env`.

## Importante para el pitch

Frase clave:

> FemVault no guarda datos médicos en blockchain. Solana se usa para consentimiento, permisos temporales y auditoría verificable.
