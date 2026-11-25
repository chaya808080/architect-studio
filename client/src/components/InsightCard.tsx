import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Lightbulb, TrendingUp } from 'lucide-react';
import type { Insight } from '../domain/smart/insights';

const TONE_ICON = { bad: AlertTriangle, warn: AlertTriangle, info: Lightbulb, good: TrendingUp };

export default function InsightCard({ insight }: { insight: Insight }) {
  const I = TONE_ICON[insight.tone];
  return (
    <div className={`card insight insight-${insight.tone}`}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className={`badge ${insight.tone}`} style={{ padding: 7 }}><I size={16} /></span>
        <div style={{ flex: 1 }}>
          <b>{insight.title}</b>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>{insight.text}</p>
        </div>
      </div>
      {insight.action && <Link to={insight.action.to} className="btn btn-sm" style={{ alignSelf: 'flex-start' }}>{insight.action.label}<ArrowLeft size={14} /></Link>}
    </div>
  );
}
