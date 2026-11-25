import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, Send, Sparkles, X } from 'lucide-react';
import { selectDb, useAppSelector } from '../store';
import { ask, SUGGESTIONS, type Answer } from '../domain/smart/assistant';

interface Msg { from: 'me' | 'bot'; text: string; links?: Answer['links'] }

// Web Speech API is not in the TS DOM lib yet - minimal typing for what we use.
type Recognition = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void };
const SpeechRecognitionImpl = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
  .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

export default function Assistant() {
  const db = useAppSelector(selectDb);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: 'היי! אני העוזר החכם של הסטודיו ✨ שאלו אותי על פרויקטים, לידים, פגישות, תשלומים או הערכת מחיר.' }]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, typing]);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMsgs(m => [...m, { from: 'me', text }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const a = ask(text, db);
      setMsgs(m => [...m, { from: 'bot', text: a.text, links: a.links }]);
      setTyping(false);
    }, 450 + Math.random() * 350);
  };

  const listen = () => {
    if (!SpeechRecognitionImpl) return;
    const rec = new SpeechRecognitionImpl();
    rec.lang = 'he-IL';
    rec.interimResults = false;
    rec.onresult = e => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  return (
    <>
      <button className={`assistant-fab ${open ? 'hidden' : ''}`} onClick={() => setOpen(true)} aria-label="פתיחת העוזר החכם">
        <Sparkles size={22} /><span>העוזר החכם</span>
      </button>
      {open && (
        <div className="assistant" role="dialog" aria-label="העוזר החכם">
          <div className="assistant-head">
            <span className="kpi-icon"><Sparkles size={17} /></span>
            <div><b>העוזר החכם</b><div className="faint" style={{ fontSize: 12 }}>עונה מתוך הנתונים בזמן אמת</div></div>
            <span className="spacer" />
            <button className="btn btn-ghost icon-btn" onClick={() => setOpen(false)} aria-label="סגירה"><X size={18} /></button>
          </div>
          <div className="assistant-list" ref={listRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`bubble ${m.from}`}>
                {m.text}
                {m.links && <div className="row wrap" style={{ marginTop: 8 }}>{m.links.map(l => <Link key={l.to} to={l.to} className="btn btn-sm" onClick={() => setOpen(false)}>{l.label}</Link>)}</div>}
              </div>
            ))}
            {typing && <div className="bubble bot typing"><span /><span /><span /></div>}
          </div>
          <div className="assistant-suggest">
            {SUGGESTIONS.map(s => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
          </div>
          <form className="assistant-input" onSubmit={e => { e.preventDefault(); send(input); }}>
            <input className="input" value={input} onChange={e => setInput(e.target.value)} placeholder="שאלו בעברית חופשית…" autoFocus />
            {SpeechRecognitionImpl && (
              <button type="button" className={`btn icon-btn ${listening ? 'btn-gold' : ''}`} onClick={listen} aria-label="שאלה קולית"><Mic size={17} /></button>
            )}
            <button className="btn btn-gold icon-btn" aria-label="שליחה"><Send size={17} /></button>
          </form>
        </div>
      )}
    </>
  );
}
