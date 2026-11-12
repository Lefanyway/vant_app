# Arquitetura de dados do VANT

Tudo no plano gratuito: Supabase (banco e contas), Upstash Redis (cache) e PandaScore (fonte dos dados).
Projeto Supabase: `vant` (ref `sriuwwdcscnorkmxvnxf`, região São Paulo). As migrações ficam em `supabase/migrations/`.

## Como os dados fluem

```
PandaScore ──(token, só na API)──> API do VANT ──ingest_esports + chave──> Supabase (fonte da verdade)
                                       │   ▲
                                       │   └── Redis (Upstash): cache compartilhado das respostas
App (Expo) ──partidas, equipes────────>│
App (Expo) ──login, perfil, favoritos, previsões (chave publicável + RLS)──> Supabase

ml/train.py ──lê partidas──> Supabase ──grava previsões (ingest_predictions + chave)──> Supabase
```

- **Sincronização**: a cada 10 minutos, enquanto a API roda, atualiza os dois últimos dias, os próximos 14 e as
  partidas ao vivo. Aos poucos, 24 semanas por rodada, carrega todo o histórico da PandaScore, desde 2021 (`VANT_BACKFILL_FROM`),
  deixando livre a cota de 1000 requisições por hora da PandaScore.
- **Leitura**: um dia já sincronizado sai do Supabase. O dia de hoje vem da PandaScore, para o placar ao vivo
  ficar certo, e é gravado de volta.
- **Cache**: cada resposta da API passa por memória do servidor → Redis → origem. Sem Redis configurado,
  a API funciona igual, só sem a camada compartilhada. `GET /api/healthz/cache` mostra acertos e erros.
- **Previsões**: a API roda `ml/train.py` 5 minutos depois de iniciar e a cada 6 horas (`VANT_ML_TRAIN=off`
  desliga). Também dá para rodar à mão com `npm run ml:train`.

## Notificações

- Quando a sincronização muda o status de uma partida para **ao vivo** ou **finalizada**, o gatilho
  `matches_notify_followers` grava um aviso em `notifications` para quem segue um dos times (ou salvou a
  partida; o resultado só se "Resultados das partidas salvas" estiver ligado).
- O app recebe pelo Supabase Realtime e mostra como notificação do celular, além do sino com contador e da tela
  **Notificações**. Tocar no aviso abre a partida.
- **Simulação para apresentação**: Perfil → **Simular notificação** chama `simulate_notification()`, que monta um
  aviso real a partir da partida finalizada mais recente (de preferência de um time favorito) e passa pelo mesmo
  caminho: banco → Realtime → celular.
- No Expo Go funciona com o app aberto ou em segundo plano. Com o app fechado, é preciso push remoto, que exige
  um development build (EAS).

## Na nuvem, sem o PC (GitHub Actions)

- `.github/workflows/sync.yml`: uma rodada de sincronização por hora (`pnpm --filter @workspace/api-server run sync:once`).
- `.github/workflows/train.yml`: retreina o modelo às 06:30 e 18:30 UTC.
- Segredos do repositório: `PANDASCORE_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_INGEST_KEY`.
- As escritas mantêm o projeto Supabase ativo, então o plano gratuito não pausa por inatividade.

## Estatísticas da equipe

A aba Estatísticas lê do Supabase (últimos 30 dias de partidas salvas) e mostra o **Elo atual** do modelo,
vindo da view `team_elo`. A PandaScore só é usada se o banco não responder.

## Tabelas

| Tabela | Conteúdo | Quem lê | Quem grava |
| --- | --- | --- | --- |
| `matches` | Partidas, com `payload` no formato da API | Todos | Só `ingest_esports` |
| `teams`, `players`, `competitions` | Equipes, elencos atuais e ligas | Todos | Só `ingest_esports` |
| `sync_runs` | Histórico das sincronizações | Todos | Só `ingest_esports` |
| `predictions` | Chance de vitória de cada partida | Todos | Só `ingest_predictions` |
| `model_runs` | Métricas e pesos de cada treino do modelo | Todos | Só `ingest_predictions` |
| `notifications` | Avisos de partida de cada conta | O dono | Gatilho do banco e `simulate_notification` |
| `team_elo` (view) | Elo atual de cada equipe | Todos | Calculada de `predictions` |
| `profiles` | Nome e preferência de cada conta | O dono | O dono |
| `favorites` | Equipes, competições e partidas salvas | O dono | O dono |

As duas funções de gravação só aceitam a chave `SUPABASE_INGEST_KEY`. O banco guarda apenas o SHA-256 dela
em `private.ingest_keys`.

## Modelo de previsão (`ml/train.py`)

- **Elo** por equipe, atualizado partida a partida: varrida 2-0 vale mais que 2-1, e equipes com menos de
  10 jogos ajustam mais rápido.
- **Regressão logística** (scikit-learn) sobre: diferença de Elo, forma nas últimas 5, confrontos diretos,
  experiência, descanso, formato da série e ordem em que a PandaScore lista os times.
- **Avaliação walk-forward**: cada partida é prevista só com o que aconteceu antes dela, refazendo o treino a
  cada 20 partidas. Compara com "só Elo" e com 50%. As métricas ficam em `model_runs.metrics`.
- O app mostra a chance na tela da partida e, nas encerradas, se o modelo acertou.

## Configuração local

- `artifacts/api-server/.env`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_INGEST_KEY`,
  e para o cache `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
- `artifacts/esports-score/.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`.

Os dois arquivos são ignorados pelo Git. A chave publicável pode ficar no app. O token do Redis, a
`service_role` e a `secret key` nunca vão para o app nem para o repositório.

## Contas

A confirmação de e-mail está desligada: o cadastro entra direto, sem enviar e-mail.
`supabase/seed.sql` (só local, ignorado pelo Git) cria uma conta de teste já confirmada.
