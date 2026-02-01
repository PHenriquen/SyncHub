# Ponte WhatsApp → Discord

Este projeto conecta um grupo específico do WhatsApp ao Discord, encaminhando mensagens de texto, imagens, vídeos, áudios e documentos para um canal do Discord.

## Requisitos
- Node.js LTS
- PM2 (para rodar sempre online)
- Baileys
- discord.js

## Instalação

1. Instale as dependências:
   ```bash
   npm install
   ```

2. (Opcional) Instale o PM2 globalmente para manter o bot sempre online:
   ```bash
   npm install -g pm2
   ```

3. Configure variáveis de ambiente (Recomendado: use secrets no Replit / variáveis de ambiente no servidor). Crie um arquivo `.env` localmente com base no `.env.example` ou defina as variáveis no painel do Replit:

   - `DISCORD_TOKEN` — token do bot do Discord (secret)
   - `DISCORD_CHANNEL_ID` — ID do canal onde as mensagens serão postadas
   - `WHATSAPP_GROUP_ID` — ID do grupo do WhatsApp a monitorar
   - `MEU_NUMERO` — seu número WhatsApp no formato `553191210861@s.whatsapp.net`
   - `SHOW_QR` — se `true`, o QR será exibido no terminal (opcional)
   - `SEND_START_MSG` — se `true`, envia mensagem ao iniciar no Discord (opcional)

4. Inicie o bot:
   ```bash
   npm start
   ```

### Rodando no Replit (deploy rápido)

- Crie um novo Repl (Node.js) e envie o projeto.
- No painel **Secrets** (Environment variables) do Replit, adicione `DISCORD_TOKEN`, `DISCORD_CHANNEL_ID`, `WHATSAPP_GROUP_ID` e `MEU_NUMERO`.
- Use o comando `npm start` no console do Replit (ou configure o botão Run para rodar `npm start`).

> **Segurança:** nunca commit seu token (`DISCORD_TOKEN`) ou o arquivo `.env`. Use as variáveis de ambiente do Replit para manter o token seguro.

## Logs
- Logs detalhados de conexão, mensagens e erros são exibidos no console e podem ser acessados via PM2:
  ```bash
  pm2 logs zap-discord-bridge
  ```

## Segurança
- Nunca compartilhe seu token do Discord publicamente.
- A pasta `baileys_auth` guarda a sessão do WhatsApp. Não apague para manter o login.

---

## index.js
O arquivo principal já está pronto para uso. Basta configurar o grupo e rodar!
