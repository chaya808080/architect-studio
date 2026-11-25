import { useEffect } from 'react';
import '@n8n/chat/style.css';
import { createChat } from '@n8n/chat';

// AI chat widget backed by an n8n workflow (chat trigger -> OpenAI).
// The webhook URL is read from .env (REACT_APP_N8N_CHAT_URL) so it never lands in source control.
export const Ai = () => {
	useEffect(() => {
		const webhookUrl = process.env.REACT_APP_N8N_CHAT_URL;
		if (webhookUrl) createChat({ webhookUrl });
	}, []);

	return (<div></div>);
};
