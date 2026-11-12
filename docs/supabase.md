# VANT no Supabase

Projeto Supabase: `vant` (ref `sriuwwdcscnorkmxvnxf`, região São Paulo, plano gratuito).
As migrações ficam em `supabase/migrations/`.

## Como os dados fluem

```
PandaScore ──(token, só na API)──> API do VANT ──ingest_esports + chave──> Supabase
                                       │                                    │
App (Expo) ──partidas, equipes────────>│                                    │
App (Expo) ──login, perfil, favoritos (chave publicável + RLS)─────────────>│
```

- A API sincroniza a cada 10 minutos enquanto estiver rodando: os dois últimos dias, os próximos 14 e as partidas ao vivo.
  Na primeira execução, ela também carrega os últimos 90 dias.
- A lista de partidas de um dia já sincronizado é lida do Supabase. O dia de hoje continua vindo da PandaScore,
  para o placar ao vivo ficar atualizado, e o resultado é gravado de volta no banco.
- O app fala direto com o Supabase só para a conta: login, perfil e favoritos.

## Tabelas

| Tabela | Conteúdo | Quem lê | Quem grava |
| --- | --- | --- | --- |
| `matches` | Partidas, com `payload` no formato da API | Todos | Só `ingest_esports` |
| `teams`, `players`, `competitions` | Equipes, elencos atuais e ligas | Todos | Só `ingest_esports` |
| `sync_runs` | Histórico das sincronizações | Todos | Só `ingest_esports` |
| `profiles` | Nome e preferência de cada conta | O dono | O dono |
| `favorites` | Equipes, competições e partidas salvas | O dono | O dono |

`ingest_esports` só grava quando recebe a chave `SUPABASE_INGEST_KEY`. O banco guarda apenas o SHA-256 dela
em `private.ingest_keys`.

## Configuração local

- `artifacts/api-server/.env`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_INGEST_KEY`.
- `artifacts/esports-score/.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`.

Os dois arquivos são ignorados pelo Git. A chave publicável pode ficar no app. Nunca coloque a `service_role`
ou a `secret key` no app nem no repositório.

## Contas

O Supabase pede confirmação de e-mail no cadastro, e o envio padrão só chega a membros da organização.
Para testar com outras pessoas, desligue em Authentication → Sign In / Providers → Email → Confirm email,
ou configure um SMTP próprio.

`supabase/seed.sql` (só local, ignorado pelo Git) cria uma conta de teste já confirmada.
