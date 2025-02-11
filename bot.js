const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const fs = require('fs')

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        keepAliveIntervalMs: 10000, // Keeps WhatsApp always online
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'close') {
            const reason = update.lastDisconnect?.error?.output?.statusCode
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Reconnecting...")
                startBot() // Auto-reconnect on crash
            }
        }
    })

    let messageCache = {}

    sock.ev.on('messages.upsert', async (msg) => {
        let m = msg.messages[0]
        if (!m.message) return

        let chatId = m.key.remoteJid
        let sender = m.key.participant || chatId

        // Store messages for retrieval if deleted
        if (!m.message.protocolMessage) {
            messageCache[m.key.id] = {
                text: m.message.conversation || m.message.extendedTextMessage?.text || "[Unsupported Message]",
                sender: sender
            }
        }

        // Handle deleted messages in private chats only
        if (m.message.protocolMessage && chatId.endsWith('@s.whatsapp.net')) {
            let deletedMsgKey = m.message.protocolMessage.key.id
            if (messageCache[deletedMsgKey]) {
                let originalText = messageCache[deletedMsgKey].text
                sock.sendMessage(sender, { text: `You deleted this message:\n\n"${originalText}"` })
            }
        }
    })
}

startBot()
