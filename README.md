# Tá na Mão! Backend

Backend do checkout direto da Tá na Mão!, preparado para criar pagamentos no Mercado Pago com Checkout Pro.

## Stack
- Node.js 20+
- Express
- Mercado Pago SDK
- Zod para validação
- Helmet + CORS

## Endpoints
- `GET /health` → status do serviço
- `POST /api/checkout/create-preference` → cria preferência de pagamento
- `POST /api/payments/webhook` → recebe notificações do Mercado Pago

## Variáveis de ambiente
Copie `.env.example` para `.env`.

## Rodando localmente
```bash
npm install
npm run dev
```

## Deploy recomendado
- Render
- Railway
- Fly.io

## Observações
Esse backend está stateless e pronto para múltiplos acessos. Para escalar de verdade, a próxima etapa é salvar pedidos em banco (Supabase/Postgres).
