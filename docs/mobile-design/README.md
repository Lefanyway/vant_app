# Design mobile de Valorant

Implementacao React Native/Expo baseada nos sete prints enviados pelo usuario.
O app usa superficies escuras, destaque roxo nos favoritos, pesquisa arredondada,
segmento Partidas/Competicoes, linhas compactas com duas equipes e placares
alinhados, competicoes por regiao, busca categorizada e navegacao inferior
flutuante. CS e LoL nao aparecem na tela principal.

## Logos e procedencia

- 48 logos de equipes e 4 logos regionais VCT baixadas diretamente do
  [handbook oficial da Riot](https://valorantesports.com/en-US/season/115571062868511862/handbook).
- Simbolo do Valorant extraido do
  [kit oficial da Riot](https://playvalorant.com/en-us/news/game-updates/valorant-asset-kit/).
- Mais 77 logos de competicoes baixadas do feed PandaScore. Essa origem fica
  identificada separadamente; nao sao declaradas como downloads diretos do organizador.
- 21 competicoes do feed nao possuem imagem informada. Sao listadas em
  `artifacts/esports-score/data/valorant-asset-report.json` e usam iniciais.
- O catalogo cobre os assets encontrados nesses dados; nao representa todas as
  equipes amadoras ou todos os torneios historicos de Valorant.

Arquivos em `assets/generated/teams` e `assets/generated/competitions` sao locais,
com nomes normalizados, aliases e IDs de competicao. O manifesto conserva a URL
de origem. A sincronizacao reduz a resolucao e retira apenas margens transparentes,
preservando proporcoes e cores. Logos locais verificadas tem prioridade sobre o
feed; logos escuras recebem uma base clara. As imagens remotas usam cache em disco.

## Validacao

- TypeScript sem erros.
- Cinco testes existentes de navegacao/perfis/busca aprovados.
- Previa dos componentes React Native no navegador em 360, 390 e 430 px, com toque
  habilitado, sem erros de execucao ou overflow horizontal.
- Favorito de partida persistiu depois de recarregar a pagina.
- Detalhes abriram com os dados da listagem antes de carregar o restante.
- Bundle iOS compilado pelo Metro com HTTP 200.

As imagens PNG nesta pasta sao capturas da previa web em dimensoes mobile,
nao capturas de um iPhone fisico. Safe areas, teclado, blur e gestos nativos
ainda precisam ser conferidos no aparelho pelo Expo Go.

## Como conferir no celular

Abra `ABRIR-VANT.cmd`, mantenha o terminal aberto e leia o QR atual.
Se o app ja estiver aberto, recarregue pelo menu do Expo ou pressione `r`
no terminal. Nao e preciso fazer outro login se a mesma conta continua conectada.

## Arquivos principais

- `components/Scoreboard.tsx`: consultas, filtros, calendario e lista virtualizada.
- `components/MobileChrome.tsx`: cabecalho, abas e estados de carregamento.
- `components/CompetitionDirectory.tsx`: competicoes expansivas e fixadas.
- `components/ResolvedLogo.tsx`: selecao, contraste, proporcoes e cache.
- `context/AppContext.tsx`: favoritos persistidos no dispositivo.
- `scripts/sync-valorant-assets.mjs`: catalogo de logos e relatorio de procedencia.
- `scripts/mobile-design-smoke.mjs`: validacao visual reproduzivel com Playwright.

Os scripts de assets e QA aceitam `VANT_ASSET_NODE_MODULES` e
`VANT_QA_NODE_MODULES` para localizar Sharp e Playwright instalados no ambiente.
`VANT_QA_BROWSER` pode apontar para um navegador Chromium ja instalado.
