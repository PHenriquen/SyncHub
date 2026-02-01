/**
 * Bridge WhatsApp -> Discord (somente leitura) com suporte a qualquer mídia
 * - Node.js LTS
 * - discord.js v14+
 * - @whiskeysockets/baileys
 *
 * CONFIG:
 * - Configure `DISCORD_TOKEN` e `DISCORD_CHANNEL_ID` via variáveis de ambiente (ex: `.env` ou secrets do Replit)
 * Sugestão pessoal: se o projeto crescer, separar helpers e integrações em arquivos próprios (ex: helpers.js, discord.js, whatsapp.js)
 * Isso facilita manutenção e deixa o código principal mais limpo.
 */

// --- CONFIGURAÇÕES ---
require('dotenv').config();

const WHATSAPP_GROUP_ID = process.env.WHATSAPP_GROUP_ID || 'COLOQUE_AQUI_O_ID_DO_SEU_GRUPO@g.us'; // ID do grupo do WhatsApp a monitorar
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || null; // definir em env
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || null; // definir em env
const MEU_NUMERO = process.env.MEU_NUMERO || '';

// Flags e helpers
const ENABLE_DISCORD = !!(DISCORD_TOKEN && DISCORD_CHANNEL_ID);
const SHOW_QR = process.env.SHOW_QR === 'true';
const SEND_START_MSG = process.env.SEND_START_MSG === 'true';

const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

if (ENABLE_DISCORD) {
  client.login(DISCORD_TOKEN).catch(() => { console.error('[DISCORD] Falha ao logar no Discord'); });
  client.once('ready', async () => {
    console.log(`[DISCORD] Online como ${client.user.tag}`);
    // Mensagem de status enviada ao canal configurado (opcional)
    if (SEND_START_MSG) {
      sendDiscordStatus('Bot WhatsApp-Discord iniciado e online!', true);
    }
  });
} else {
  console.log('[INFO] Integração com Discord desabilitada. Defina DISCORD_TOKEN e DISCORD_CHANNEL_ID para habilitar.');
}
const qrcode = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  jidNormalizedUser,
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');



// --- Utils ---
// Função para converter stream em buffer
// (anotação: útil para downloads de mídia, manter caso precise debugar ou adaptar para outros tipos de stream)
function bufferFromStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

// Inicia integração WhatsApp/Discord
// (anotação: se quiser reiniciar manualmente, só chamar startSock() de novo)
startSock();

if (!WHATSAPP_GROUP_ID || WHATSAPP_GROUP_ID === 'COLOQUE_AQUI_O_ID_DO_SEU_GRUPO@g.us') {
  // Dica: coloque o ID do grupo do WhatsApp aqui para ativar a ponte
  console.log('[INFO] Defina o WHATSAPP_GROUP_ID corretamente para ativar a ponte.');
} else {
  // Ponte ativa para o grupo configurado
  console.log(`[INFO] Ponte ativa para grupo: ${WHATSAPP_GROUP_ID}`);
}

// Captura erros globais para facilitar debug e estabilidade
// (anotação: importante para não travar o processo em caso de erro inesperado)
process.on('uncaughtException', (err) => {
  console.error('[GLOBAL] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[GLOBAL] Unhandled rejection:', err);
});

// Dica pessoal: se o arquivo crescer muito, separar helpers e handlers em arquivos próprios (ex: helpers.js, discord.js, whatsapp.js)


  // --- Helper: envia texto e anexo ao canal do Discord ---
  // 'persist' indica se a mensagem deve permanecer no canal (true) ou ser apagada automaticamente (false)
  function sendToDiscord({ text, attachmentBuffer, fileName, author, type, persist = false, delayMs = 10000 }) {
    if (!ENABLE_DISCORD) {
      console.log(`[DISCORD disabled] ${author ? `📱 ${author}:` : '📱 WhatsApp:'} ${type} ${fileName ? `[anexo: ${fileName}]` : ''} ${text ? `— ${text.substring(0,200)}` : ''}`);
      return;
    }
    const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
    if (!channel) {
      console.error('Canal do Discord não encontrado!');
      return;
    }
    const who = author ? `📱 WhatsApp | ${author}:` : '📱 WhatsApp:';
    let content = `${who}`;
    if (type === 'text') content += `\n${text || ''}`;

    if (attachmentBuffer && fileName) {
      const attachment = new AttachmentBuilder(attachmentBuffer).setName(fileName);
      channel.send({ content, files: [attachment] }).then((sentMsg) => {
        if (!persist) {
          setTimeout(() => sentMsg.delete().catch(() => {}), delayMs);
        }
      }).catch(()=>{});
    } else if (type === 'text') {
      channel.send({ content }).then((sentMsg) => {
        if (!persist) {
          setTimeout(() => sentMsg.delete().catch(() => {}), delayMs);
        }
      }).catch(()=>{});
    }
  }

  // Função auxiliar para baixar mídia (imagem ou vídeo)
  async function downloadMedia(message, mediaType) {
    try {
      const stream = await downloadContentFromMessage(message, mediaType);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (e) {
      console.error(`[WHATSAPP] Erro ao baixar ${mediaType}:`, e);
      return null;
    }
  }

  // Função auxiliar para enviar arquivo para o Discord
  // 'persist' indica se a mensagem deve permanecer no canal (true) ou ser apagada automaticamente (false)
  function sendFileToDiscord({ buffer, fileName, caption, author, type, persist = false, delayMs = 10000 }) {
    if (!ENABLE_DISCORD) {
      console.log(`[DISCORD disabled] ${author ? `📱 ${author}:` : '📱 WhatsApp:'} arquivo ${fileName} ${caption ? `— ${caption}` : ''}`);
      return;
    }
    const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
    if (!channel) {
      console.error('Canal do Discord não encontrado!');
      return;
    }
    const who = author ? `📱 WhatsApp | ${author}:` : '📱 WhatsApp:';
    let content = `${who}`;
    if (caption) content += `\n${caption}`;
    const attachment = new AttachmentBuilder(buffer).setName(fileName);
    channel.send({ content, files: [attachment] }).then((sentMsg) => {
      if (!persist) {
        setTimeout(() => sentMsg.delete().catch(() => {}), delayMs);
      }
    }).catch(()=>{});
  }

  // Envia status/alerta para o canal do Discord. Mensagens automáticas podem ser apagadas após alguns segundos.
  function sendDiscordStatus(msg, apagarDepois = false, delayMs = 10000) {
    if (!ENABLE_DISCORD) {
      console.log(`[DISCORD disabled] STATUS: ${msg}`);
      return;
    }
    const channel = client.channels.cache.get(DISCORD_CHANNEL_ID);
    if (!channel) {
      console.error('Canal do Discord não encontrado!');
      return;
    }
    channel.send(msg).then((sentMsg) => {
      if (apagarDepois) {
        setTimeout(() => {
          sentMsg.delete().catch(()=>{});
        }, delayMs);
      }
    }).catch(()=>{});
  }

  // Observação: a inicialização do socket do Baileys foi refatorada para suportar reconexão automática

  // --- Baileys: função de inicialização com reconexão automática ---
  let sock = null;
  let reconnectAttempts = 0;

  async function startSock() {
      try {
        const authFolder = './baileys_auth'; // pasta onde credenciais serão salvas
        const { state, saveCreds } = await useMultiFileAuthState(authFolder);

        const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 2323, 3] }));

        // Cria socket do WhatsApp (nós gerenciamos o QR com qrcode-terminal)
        sock = makeWASocket({ auth: state, printQRInTerminal: false, version });

        // Salva credenciais quando atualizadas
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          console.log('QR Code gerado - escaneie com o WhatsApp.');
          if (SHOW_QR) {
            try { qrcode.generate(qr, { small: true }); } catch (e) {}
          } else {
            console.log('[INFO] QR gerado mas SHOW_QR=false. Defina SHOW_QR=true para ver o QR no terminal.');
          }
        }
        if (connection) console.log('WhatsApp connection status:', connection);

        // Feedback de status no Discord (usa função global sendDiscordStatus)
        // Mensagens automáticas devem usar sendDiscordStatus(msg, true) para serem apagadas automaticamente.

        if (connection === 'close') {
          const errorCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode || lastDisconnect?.error?.code;
          const errorMsg = lastDisconnect?.error?.output?.payload || lastDisconnect?.error?.message || lastDisconnect;
          console.log('WhatsApp desconectado:', errorMsg);
          sendDiscordStatus(':warning: WhatsApp desconectado. Tentando reconectar...', true);
          // Tratamento especial para erros de autenticação
          if (errorCode === 401 || errorMsg?.toString().includes('401') || errorMsg?.toString().toLowerCase().includes('unauthorized') || errorMsg?.toString().toLowerCase().includes('stream errored')) {
            console.error('[SESSION] Erro de autenticação (401/Unauthorized/Stream Errored).');
            console.error('[SESSION] Por favor, escaneie o QR Code novamente para parear o WhatsApp.');
            // Erros de autenticação são críticos — manter a mensagem para facilitar diagnóstico
            sendDiscordStatus(':x: Erro de autenticação no WhatsApp. Bot será encerrado.', false);
            process.exit(1);
          }
          // Detecta erro de stream (ex.: 515) e tenta reconectar com backoff
          reconnectAttempts++;
          const delay = Math.min(30000, 2000 * reconnectAttempts);
          console.log(`Reconectando em ${delay / 1000}s (tentativa ${reconnectAttempts})`);
          setTimeout(() => startSock(), delay);
        }

        if (connection === 'open') {
          reconnectAttempts = 0;
          sendDiscordStatus(':green_circle: WhatsApp reconectado e online!', true);
        }
      });

      // --- Listener de mensagens do WhatsApp (modo descoberta ou filtrado por grupo) ---
      sock.ev.on('messages.upsert', async (upsert) => {
        try {
          if (!upsert?.messages) return;
          for (const msg of upsert.messages) {
            const remoteJid = msg.key?.remoteJid;
            // Log detalhado de todas as mensagens recebidas
            let groupName = '[privado/desconhecido]';
            if (remoteJid?.endsWith('@g.us')) {
              try {
                const meta = await sock.groupMetadata(remoteJid);
                groupName = meta?.subject || '[grupo sem nome]';
              } catch { groupName = '[grupo sem nome]'; }
            } else {
              groupName = msg.pushName || '[privado]';
            }

            // Identifica autor e se a mensagem foi enviada por MEU_NUMERO (persistirá se for true)
            const authorId = msg.key?.participant || msg.participant || msg.key?.remoteJid;
            const fromMe = authorId === MEU_NUMERO;

            let type = 'unknown';
            let text = '';
            if (msg.message?.conversation) {
              type = 'text';
              text = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
              type = 'text';
              text = msg.message.extendedTextMessage.text;
            } else if (msg.message?.imageMessage) {
              type = 'image';
              text = msg.message.imageMessage.caption || '';
            } else if (msg.message?.videoMessage) {
              type = 'video';
              text = msg.message.videoMessage.caption || '';
            } else if (msg.message?.audioMessage) {
              type = 'audio';
            } else if (msg.message?.documentMessage) {
              type = 'document';
              text = msg.message.documentMessage.caption || '';
            }
            console.log('[WHATSAPP]');
            console.log('remoteJid:', remoteJid);
            console.log('nome:', groupName);
            console.log('tipo:', type);
            if (text) console.log('texto/caption:', text);

            // Só processa mensagens do grupo monitorado
            if (remoteJid !== WHATSAPP_GROUP_ID) continue;

            // Encaminhamento para Discord
            let attachmentBuffer = null;
            let fileName = '';
            if (msg.message?.imageMessage) {
              try {
                const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                attachmentBuffer = await bufferFromStream(stream);
                fileName = `image_${Date.now()}.jpg`;
              } catch (e) { console.warn('[WHATSAPP] Falha ao baixar imagem', e); }
            } else if (msg.message?.videoMessage) {
              try {
                const stream = await downloadContentFromMessage(msg.message.videoMessage, 'video');
                attachmentBuffer = await bufferFromStream(stream);
                fileName = `video_${Date.now()}.mp4`;
              } catch (e) { console.warn('[WHATSAPP] Falha ao baixar vídeo', e); }
            } else if (msg.message?.audioMessage) {
              try {
                const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
                attachmentBuffer = await bufferFromStream(stream);
                fileName = `audio_${Date.now()}.ogg`;
              } catch (e) { console.warn('[WHATSAPP] Falha ao baixar áudio', e); }
            } else if (msg.message?.documentMessage) {
              try {
                const stream = await downloadContentFromMessage(msg.message.documentMessage, 'document');
                attachmentBuffer = await bufferFromStream(stream);
                fileName = msg.message.documentMessage.fileName || `document_${Date.now()}`;
              } catch (e) { console.warn('[WHATSAPP] Falha ao baixar documento', e); }
            }

            // Envia para o Discord (será apagada automaticamente se não for sua mensagem)
            if (type === 'text' && text?.trim()) {
              sendToDiscord({ text: text.trim(), author: groupName, type, persist: fromMe });
            } else if (type === 'image' && msg.message?.imageMessage) {
              console.log('[WHATSAPP] Imagem recebida, baixando...');
              const buffer = await downloadMedia(msg.message.imageMessage, 'image');
              if (buffer) {
                const fileName = `image_${Date.now()}.jpg`;
                sendFileToDiscord({ buffer, fileName, caption: text, author: groupName, type: 'image', persist: fromMe });
                console.log('[DISCORD] Imagem enviada para o canal Discord.');
              }
            } else if (type === 'video' && msg.message?.videoMessage) {
              console.log('[WHATSAPP] Vídeo recebido, baixando...');
              const buffer = await downloadMedia(msg.message.videoMessage, 'video');
              if (buffer) {
                const fileName = `video_${Date.now()}.mp4`;
                sendFileToDiscord({ buffer, fileName, caption: text, author: groupName, type: 'video', persist: fromMe });
                console.log('[DISCORD] Vídeo enviado para o canal Discord.');
              }
            }
          }
        } catch (err) {
          console.error('[WHATSAPP] Erro processando mensagem:', err);
        }
        try {
          if (!upsert.messages) return;
          for (const msg of upsert.messages) {
            if (!msg.message) continue;
            if (msg.key && msg.key.remoteJid === 'status@broadcast') continue;
            if (msg.key && msg.key.fromMe) continue;
            if (msg.message?.protocolMessage) continue;
            if (msg.message?.messageContextInfo) continue;
            if (msg.message?.ephemeralMessage) continue;
            if (msg.message?.viewOnceMessage) continue;
            if (msg.message?.senderKeyDistributionMessage) continue;

            // Ignora mensagens antigas (histNotification)
            if (msg.message?.messageStubType) continue;

            let remoteJid = msg.key && msg.key.remoteJid;
            if (!remoteJid.endsWith('@g.us')) continue; // só grupos

            // Só mensagens enviadas pelo MEU_NUMERO
            const authorId = msg.key.participant || msg.participant || msg.key.remoteJid;
            if (authorId !== MEU_NUMERO) continue;

            // Extrai tipo e texto/caption
            let type = 'unknown';
            let text = '';
            let attachmentBuffer = null;
            let fileName = '';
            if (msg.message.conversation) {
              type = 'text';
              text = msg.message.conversation;
            } else if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) {
              type = 'text';
              text = msg.message.extendedTextMessage.text;
            } else if (msg.message.imageMessage) {
              type = 'image';
              text = msg.message.imageMessage.caption || '';
              try {
                const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                attachmentBuffer = await bufferFromStream(stream);
                fileName = `image_${Date.now()}.jpg`;
              } catch (e) { console.warn('[WHATSAPP] Falha ao baixar imagem', e); }
            } else if (msg.message.videoMessage) {
              type = 'video';
              text = msg.message.videoMessage.caption || '';
              try {
                const stream = await downloadContentFromMessage(msg.message.videoMessage, 'video');
                attachmentBuffer = await bufferFromStream(stream);
                fileName = `video_${Date.now()}.mp4`;
              } catch (e) { console.warn('[WHATSAPP] Falha ao baixar vídeo', e); }
            } else if (msg.message.audioMessage) {
              type = 'audio';
              try {
                const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
                attachmentBuffer = await bufferFromStream(stream);
                fileName = `audio_${Date.now()}.ogg`;
              } catch (e) { console.warn('[WHATSAPP] Falha ao baixar áudio', e); }
            } else if (msg.message.documentMessage) {
              type = 'document';
              text = msg.message.documentMessage.caption || '';
              try {
                const stream = await downloadContentFromMessage(msg.message.documentMessage, 'document');
                attachmentBuffer = await bufferFromStream(stream);
                fileName = msg.message.documentMessage.fileName || `document_${Date.now()}`;
              } catch (e) { console.warn('[WHATSAPP] Falha ao baixar documento', e); }
            } else {
              continue;
            }

            // Nome do grupo
            let groupName = '[unknown]';
            try {
              const meta = await sock.groupMetadata(remoteJid);
              groupName = meta?.subject || '[unknown]';
            } catch {}

            // Autor
            let author = 'unknown';
            if (msg.pushName) {
              author = msg.pushName;
            } else if (authorId) {
              author = authorId.split('@')[0];
            }

            // LOG SEGURO
            console.log('[WHATSAPP]');
            console.log(`groupId: ${remoteJid}`);
            console.log(`groupName: ${groupName}`);
            console.log(`author: ${author}`);
            console.log(`tipo: ${type}`);
            if (text) console.log(`texto/caption: ${text}`);

            // Envia para o Discord se for texto, imagem, vídeo, áudio ou documento
            if (type === 'text' && text?.trim()) {
              await sendToDiscord({ text: text.trim(), author, type, persist: true });
            } else if (['image','video','audio','document'].includes(type) && attachmentBuffer) {
              await sendToDiscord({ text: text?.trim(), author, attachmentBuffer, fileName, type, persist: true });
            }
          }
        } catch (err) {
          console.error('[WHATSAPP] Erro processando mensagem:', err);
        }
      });
      console.log('Bridge rodando: WhatsApp ativo, aguardando mensagens do seu número em grupos...');
    } catch (err) {
      console.error('Erro iniciando Baileys socket:', err);
      reconnectAttempts++;
      const delay = Math.min(30000, 2000 * reconnectAttempts);
      console.log(`Tentando reiniciar em ${delay / 1000}s`);
      setTimeout(() => startSock(), delay);
    }
  }
