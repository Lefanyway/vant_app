# Próximos passos do VANT

Ideias avaliadas e guardadas para depois. Ordem sugerida dentro de cada grupo.

## Must have

1. **API publicada na internet.** Hoje ela roda no computador de quem desenvolve; sem isso o app só funciona na mesma rede Wi-Fi.
2. **Push com o app fechado.** Exige um build de desenvolvimento do EAS (gratuito); o banco já gera os eventos de início e fim de partida.

## Nice to have (inspirado em apps de placar como o Sofascore)

- **Página do jogador:** estatísticas por partida (ACS, K/D, agentes) e uma nota por jogo.
- **Linha do tempo da partida ao vivo:** mapa a mapa, com o placar de cada mapa. Conferir antes o que o plano gratuito da PandaScore entrega.
- **Votação da torcida:** "quem vence?" antes do jogo, lado a lado com a previsão do modelo.
- **Widget / Live Activity** com o placar da partida que você acompanha (precisa do build de desenvolvimento).

## Arquitetura

- Vale fazer: manter testes no GitHub Actions a cada envio; atualizar o Expo nas versões de correção.
- Não vale agora: microsserviços, GraphQL ou trocar o Express. O tamanho do projeto não justifica.
