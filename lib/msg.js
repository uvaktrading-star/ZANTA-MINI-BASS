const { proto, downloadContentFromMessage, getContentType, jidNormalizedUser } = require('@whiskeysockets/baileys')
const fs = require('fs')

const downloadMediaMessage = async(m, filename) => {
	// View Once V1/V2 සඳහා m.type යළි සකසයි
	if (m.type === 'viewOnceMessage' || m.type === 'viewOnceMessageV2') {
		m.type = m.msg.type
	}
    
    // JID Normalization භාවිතයෙන් remoteJid එක නිවැරදි කරන්න
    if (m.key?.remoteJid) {
        m.key.remoteJid = jidNormalizedUser(m.key.remoteJid);
    }

	// Media Type එක හඳුනාගැනීම
	let type = m.type.replace('Message', '')
	if (m.type === 'imageMessage') type = 'image'
	else if (m.type === 'videoMessage') type = 'video'
	else if (m.type === 'audioMessage') type = 'audio'
	else if (m.type === 'stickerMessage') type = 'sticker'
	else if (m.type === 'documentMessage') type = 'document'

	const stream = await downloadContentFromMessage(m.msg, type)
	let buffer = Buffer.from([])
	for await (const chunk of stream) {
		buffer = Buffer.concat([buffer, chunk])
	}

	// RAM Optimization: ෆයිල් එක සේව් කරනවා පමණයි, ආපහු කියවන්නේ නැතුව කෙලින්ම buffer එක return කරයි
	if (filename) {
		let ext = '.bin'
		if (m.type === 'imageMessage') ext = '.jpg'
		else if (m.type === 'videoMessage') ext = '.mp4'
		else if (m.type === 'audioMessage') ext = '.mp3'
		else if (m.type === 'stickerMessage') ext = '.webp'
		else if (m.type === 'documentMessage') ext = '.' + m.msg.fileName.split('.').pop()
		
		fs.writeFileSync(filename + ext, buffer)
	}
	
	return buffer
}

const sms = (zanta, m) => {
	if (m.key) {
		m.id = m.key.id
		m.chat = m.key.remoteJid
		m.fromMe = m.key.fromMe
		m.isGroup = m.key.remoteJid.endsWith('@g.us')
		m.sender = jidNormalizedUser(m.fromMe ? zanta.user.id : (m.isGroup ? m.key.participant : m.key.remoteJid))
	}
	if (m.message) {

		// 1. Ephemeral Wrapper ඉවත් කිරීම
		if (getContentType(m.message) === 'ephemeralMessage') {
				m.message = m.message.ephemeralMessage.message;
		}

		m.type = getContentType(m.message)

		// M.MSG DEFINITION
		if (m.type === 'viewOnceMessage') {
			m.msg = m.message[m.type].message[getContentType(m.message[m.type].message)]
            m.msg.type = getContentType(m.message[m.type].message);
		} else if (m.type === 'viewOnceMessageV2') {
			m.msg = m.message[m.type].message[getContentType(m.message[m.type].message)]
            m.msg.type = getContentType(m.message[m.type].message);
		} else {
			m.msg = m.message[m.type]
		}

		if (m.msg) {
			var quotedMention = m.msg.contextInfo != null ? m.msg.contextInfo.participant : ''
			var tagMention = m.msg.contextInfo != null ? m.msg.contextInfo.mentionedJid : []
			var mention = typeof(tagMention) == 'string' ? [tagMention] : tagMention
			if (mention && quotedMention) mention.push(quotedMention)
			m.mentionUser = mention ? mention.filter(x => x) : []

			m.body = (m.type === 'conversation') ? m.msg : (m.type === 'extendedTextMessage') ? m.msg.text : (m.msg.caption) ? m.msg.caption : (m.type == 'templateButtonReplyMessage') && m.msg.selectedId ? m.msg.selectedId : (m.type == 'buttonsResponseMessage') && m.msg.selectedButtonId ? m.msg.selectedButtonId : ''

			m.quoted = m.msg.contextInfo != undefined ? m.msg.contextInfo.quotedMessage : null

			if (m.quoted) {
                // FIX C: Android Reply Fix
                if (m.quoted.message && getContentType(m.quoted) === 'messageContextInfo') {
                    m.quoted = m.quoted.message;
                }
                
                // FIX B: View Once Wrapper
                const content = getContentType(m.quoted);
                if (content === 'viewOnceMessage') {
                    m.quoted = m.quoted.viewOnceMessage.message;
                } else if (content === 'viewOnceMessageV2') {
                    m.quoted = m.quoted.viewOnceMessageV2.message;
                }
                
				if (getContentType(m.quoted) === 'ephemeralMessage') {
						m.quoted = m.quoted.ephemeralMessage.message;
				}
                
				m.quoted.type = getContentType(m.quoted)
				m.quoted.id = m.msg.contextInfo.stanzaId
				m.quoted.sender = jidNormalizedUser(m.msg.contextInfo.participant)
				m.quoted.fromMe = m.quoted.sender.split('@')[0].includes(zanta.user.id.split(':')[0])
				m.quoted.isStatus = m.msg.contextInfo?.remoteJid === 'status@broadcast';

				m.quoted.msg = m.quoted[m.quoted.type];

                if (m.quoted.msg && m.quoted.msg.viewOnce !== undefined) {
                     m.quoted.msg.viewOnce = true; 
                }
                
				m.quoted.body = (m.quoted.type === 'conversation') ? m.quoted.msg : (m.quoted.type === 'extendedTextMessage') ? m.quoted.msg.text : (m.quoted.msg.caption) ? m.quoted.msg.caption : ''

				m.quoted.fakeObj = proto.WebMessageInfo.fromObject({
					key: {
						remoteJid: m.chat,
						fromMe: m.quoted.fromMe,
						id: m.quoted.id,
						participant: m.quoted.sender
					},
					message: m.quoted
				})
				m.quoted.download = (filename) => downloadMediaMessage(m.quoted, filename)
				m.quoted.delete = () => zanta.sendMessage(m.chat, { delete: m.quoted.fakeObj.key })
				m.quoted.react = (emoji) => zanta.sendMessage(m.chat, { react: { text: emoji, key: m.quoted.fakeObj.key } })
			}
		}
		m.download = (filename) => downloadMediaMessage(m, filename)
	}

	m.reply = (teks, id = m.chat, option = { mentions: [m.sender] }) => zanta.sendMessage(id, { text: teks, contextInfo: { mentionedJid: option.mentions } }, { quoted: m })
	m.replyS = (stik, id = m.chat, option = { mentions: [m.sender] }) => zanta.sendMessage(id, { sticker: stik, contextInfo: { mentionedJid: option.mentions } }, { quoted: m })
	m.replyImg = (img, teks, id = m.chat, option = { mentions: [m.sender] }) => zanta.sendMessage(id, { image: img, caption: teks, contextInfo: { mentionedJid: option.mentions } }, { quoted: m })
	m.replyVid = (vid, teks, id = m.chat, option = { mentions: [m.sender], gif: false }) => zanta.sendMessage(id, { video: vid, caption: teks, gifPlayback: option.gif, contextInfo: { mentionedJid: option.mentions } }, { quoted: m })
	m.replyAud = (aud, id = m.chat, option = { mentions: [m.sender], ptt: false }) => zanta.sendMessage(id, { audio: aud, ptt: option.ptt, mimetype: 'audio/mpeg', contextInfo: { mentionedJid: option.mentions } }, { quoted: m })
	m.replyDoc = (doc, id = m.chat, option = { mentions: [m.sender], filename: 'undefined.pdf', mimetype: 'application/pdf' }) => zanta.sendMessage(id, { document: doc, mimetype: option.mimetype, fileName: option.filename, contextInfo: { mentionedJid: option.mentions } }, { quoted: m })
	m.replyContact = (name, info, number) => {
		var vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + 'FN:' + name + '\n' + 'ORG:' + info + ';\n' + 'TEL;type=CELL;type=VOICE;waid=' + number + ':+' + number + '\n' + 'END:VCARD'
		zanta.sendMessage(m.chat, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted: m })
	}
	m.react = (emoji) => zanta.sendMessage(m.chat, { react: { text: emoji, key: m.key } })

	return m
}

module.exports = { sms, downloadMediaMessage }
