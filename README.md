# FinDash — Painel Financeiro Pessoal

Dashboard financeiro em tempo real integrado com Firebase e Pluggy Open Finance.

## Setup em 5 passos

### 1. Instalar dependências
```bash
npm install
cd functions && npm install && cd ..
cd etl && pip install -r requirements.txt && cd ..
```

### 2. Configurar Firebase (frontend)
Crie o arquivo `.env.local` na raiz:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Atualize `.firebaserc` com o seu Project ID:
```json
{ "projects": { "default": "seu-projeto" } }
```

### 3. Configurar ETL Python
Copie e preencha o `.env` do ETL:
```bash
cp etl/.env.example etl/.env
# Edite etl/.env com suas credenciais Pluggy e Firebase
```

Para gerar o `FIREBASE_ETL_SECRET`, use:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Deploy Firebase
```bash
firebase login
firebase use seu-projeto
npm run build
firebase deploy
```

### 5. Configurar o segredo do webhook no Firestore
No Console Firebase → Firestore → Coleção `/config` → Documento `etl_webhook_secret`:
```json
{ "value": "o_mesmo_segredo_do_ETL_SECRET" }
```

---

## Rodar localmente
```bash
npm run dev        # Frontend em http://localhost:5173
firebase emulators:start  # Firebase local (Firestore + Functions)
```

## Rodar o ETL manualmente
```bash
cd etl
python etl_pluggy.py
```

## Estrutura do projeto
```
findash/
├── src/              # Frontend React + Vite
│   ├── pages/        # 7 páginas (Login, Dashboard, Contas, ...)
│   ├── components/   # UI, layout, cards, charts, tables
│   ├── hooks/        # Hooks Firebase real-time
│   ├── store/        # Zustand global state
│   └── lib/          # Firebase init + formatters
├── functions/        # Cloud Functions (webhook ETL + forceEtl)
├── etl/              # Python ETL (Pluggy → Firebase)
├── firestore.rules   # Segurança Firestore
└── storage.rules     # Segurança Storage
```

## Banco → Cor
| Banco     | Cor        |
|-----------|-----------|
| Nubank    | `#8a05be` |
| Santander | `#ec0000` |
| Inter     | `#ff7a00` |
