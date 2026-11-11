# Abrir o VANT no Expo Go

Use o checkout `wt-grok`: era o checkout da API ativa ao fazer este diagnostico.

## Login no Expo antes da primeira abertura

Entre no Expo Go do celular e na CLI do computador com a mesma conta Expo.
No PowerShell, execute:

```powershell
cd C:\caminho\do\projeto\wt-grok\artifacts\esports-score
node .\node_modules\expo\bin\cli login
node .\node_modules\expo\bin\cli whoami
```

Siga as instrucoes do login. O comando `whoami` confirma a conta conectada.
Normalmente o login fica salvo. Depois, pare o Expo anterior com Ctrl+C,
abra `ABRIR-VANT.cmd` e leia o novo QR no celular.

Referencia: https://docs.expo.dev/get-started/start-developing/

Se o celular pedir login mesmo depois de entrar, confirme a mesma conta nos
dois dispositivos e reinicie o servidor pelo launcher. O launcher inicia
o Expo online: o modo EXPO_OFFLINE impede a verificacao da conta e pode
causar essa mensagem. Um servidor que ja estava aberto precisa ser reiniciado.

## Todo dia

1. Ligue o computador e conecte computador e celular ao mesmo Wi-Fi.
2. Abra `ABRIR-VANT.cmd` na pasta acima de `wt-grok`, ou use PowerShell:

```powershell
cd C:\caminho\do\projeto\wt-grok
npm run dev:phone
```

3. Deixe o terminal aberto. O comando detecta o IP, reutiliza a API se estiver
   funcionando ou compila e inicia a API. Depois inicia o Expo Go em modo LAN,
   com o endereco correto da API. Nenhuma instalacao diaria e necessaria.
4. Leia o QR NOVO com a camera do iPhone e abra no Expo Go. No Android, use
   o leitor do Expo Go. Nao use um QR antigo salvo em imagem.
   O launcher salva uma copia em `.expo/phone-qr.svg`. Use uma unica instancia
   do comando; abrir varias pode mudar a porta. O QR exibido pelo Expo no terminal
   e a referencia final caso a porta seja alterada durante a inicializacao.
5. Para parar, Ctrl+C. Se fechar o terminal, suspender o PC ou mudar de Wi-Fi,
   rode o comando novamente e leia o novo QR.

## Configuracao unica da PandaScore

Se a API ja esta configurada, nao precisa criar outro token. Quando necessario,
salve apenas no arquivo privado `artifacts/api-server/.env`:

```dotenv
PANDASCORE_API_TOKEN=SEU_TOKEN_REAL
```

O arquivo e ignorado pelo Git. Nao coloque o token em EXPO_PUBLIC, no celular,
em prints ou no codigo. Depois de alterar o token, reinicie a API. O launcher
reutiliza uma API existente e nao muda as credenciais dela.

## Diagnostico sem adivinhar

```powershell
npm run check:phone
```

O script imprime o endereco da API. Abra o endereco terminado em
`/api/healthz` no Safari do celular: deve aparecer `{"status":"ok"}`.
O IP observado nesta verificacao foi 192.168.0.10 e a API estava na porta 5000,
mas o script detecta o IP novamente em cada execucao.

- Timeout ANTES de aparecer o app: confira Expo rodando, QR novo, mesmo Wi-Fi,
  permissao de Rede Local para Expo Go no iPhone e se o computador esta acordado.
- App abre, mas partidas nao carregam: teste `/api/healthz` no celular. Se nao
  abrir, e acesso a API, nao a PandaScore. Se abrir, confira o token e os logs
  da API. Uma resposta 401/403 do fornecedor pode indicar credencial/permissao;
  429 indica limite de chamadas.
- `localhost` ou `127.0.0.1` no endereco da API nao servem para um celular fisico.
- Windows: permita Node.js nas redes privadas quando solicitado pelo Firewall.
  Nao desative o Firewall. Redes de convidados podem impedir acesso entre aparelhos.
- Se o IP detectado for de uma VPN/adaptador errado, antes de iniciar:

```powershell
$env:VANT_LAN_IP = 'IP_DO_WIFI_DO_PC'
npm run dev:phone
```

- Expo nao inicia: leia o erro do terminal. Nao e necessario rodar novamente
  `pnpm install` salvo quando as dependencias mudarem ou estiverem ausentes.
  Se precisar limpar o cache uma vez: `npm run dev:phone -- --clear`.
- Expo Go precisa ser compativel com o SDK do projeto. Este checkout usa Expo 54;
  se o aplicativo informar SDK incompatível, use uma development build compativel
  ou uma migracao de SDK validada, em vez de tratar isso como timeout de rede.

## API e Expo sao dois servicos diferentes

PandaScore e o fornecedor externo; nao precisa ser "ligada" a cada uso.
Seu backend precisa estar ativo para consultar o fornecedor, e o Metro/Expo
precisa estar ativo para entregar o app de desenvolvimento ao celular.

Um tunnel do Expo publica apenas o servidor de desenvolvimento, nao o backend.
Para acessar fora do mesmo Wi-Fi, a API tambem precisa de um endereco acessivel,
preferencialmente HTTPS com certificado confiavel. Nao desative validacao TLS.

Para abrir sem depender do PC/QR/terminal, e necessario hospedar a API e instalar
uma build do app. Isso e uma etapa de publicacao diferente do Expo Go local.

Fontes: [Expo: iniciar desenvolvimento](https://docs.expo.dev/get-started/start-developing/),
[Expo CLI e conexoes](https://docs.expo.dev/more/expo-cli/),
[Variaveis EXPO_PUBLIC](https://docs.expo.dev/guides/environment-variables/).
