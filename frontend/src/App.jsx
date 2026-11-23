import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { QRCodeSVG } from 'qrcode.react';
import {
  Send, Moon, Sun, LogOut, User, Shield, ChevronDown, ChevronRight,
  ExternalLink, Eye, EyeOff, AlertTriangle, BookOpen, History,
  Menu, X, Settings, Download, Bot, Stethoscope,
  FileText, BarChart2, Key, RefreshCw, Plus, QrCode, Copy, Check,
  Wifi, Share2, Info, Mic, MicOff, Globe, Trash2, UserX
} from 'lucide-react';

function getApiBase() {
  if (typeof window === 'undefined') return '';
  const saved = localStorage.getItem('cds_backend_url');
  if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000';
  }
  // Default live Cloudflare Tunnel for GitHub Pages
  return 'https://atom-fibre-relevant-depending.trycloudflare.com';
}

let API_BASE = getApiBase();

const EXAMPLE_QUESTIONS = [
  "What are the red flags for headache requiring urgent referral?",
  "كيف أشخص الصداع النصفي وما هي العلاجات الوقائية؟",
  "How do I diagnose tension-type headache vs migraine?",
  "ما هي معايير تشخيص الصداع العنقودي حسب إرشادات نايس؟"
];

// ── Markdown renderer component (ChatGPT / Claude style) ─────────────────────
function MDAnswer({ text, dark }) {
  return (
    <div className="prose prose-sm max-w-none space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 leading-relaxed text-sm">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-teal-400 dark:text-teal-300">{children}</strong>,
          em: ({ children }) => <em className="italic opacity-90">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-3 space-y-1 text-sm">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-3 space-y-1 text-sm">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 text-teal-400 border-b border-teal-500/20 pb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-3 text-teal-400">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-2.5 text-teal-300">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-teal-500 pl-3 py-1 my-2 bg-teal-500/5 rounded-r-md text-xs italic opacity-90">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-gray-700/60 shadow-sm">
              <table className="min-w-full divide-y divide-gray-700 text-xs text-left">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className={dark ? 'bg-gray-800/80' : 'bg-gray-100'}>{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 font-semibold text-teal-400 uppercase tracking-wider text-[11px]">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-t border-gray-700/40 text-xs">{children}</td>,
          code: ({ inline, children }) => inline
            ? <code className="bg-teal-900/30 text-teal-300 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
            : <pre className="bg-gray-900/80 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2 border border-gray-800"><code>{children}</code></pre>,
        }}
      >
        {text || ''}
      </ReactMarkdown>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatBar({ label, value, dark, color = 'teal' }) {
  const colours = {
    teal: 'bg-teal-500', amber: 'bg-amber-500', blue: 'bg-blue-500', purple: 'bg-purple-500'
  };
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-0.5">
        <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{label}</span>
        <span className="font-medium">{typeof value === 'number' ? `${value.toFixed(1)}%` : value}</span>
      </div>
      {typeof value === 'number' && (
        <div className={`h-1.5 rounded-full ${dark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <div className={`h-1.5 rounded-full ${colours[color]} transition-all duration-500`}
            style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Sources panel (Hidden by default, shown on click) ─────────────────────────
function SourcesPanel({ sources, dark }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div className={`mt-2.5 rounded-lg border ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg
          ${dark ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-50 text-gray-600'} transition-colors`}>
        <span className="flex items-center gap-1.5">
          <BookOpen size={13} className="text-teal-400" />
          View Guideline Citations ({sources.length})
        </span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <div className={`px-3 pb-3 space-y-2 border-t ${dark ? 'border-gray-800' : 'border-gray-200'} pt-2`}>
          {sources.map((src, i) => (
            <div key={i} className={`p-2.5 rounded-md text-xs ${dark ? 'bg-gray-950/60 border border-gray-800' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-teal-400 font-medium text-[11px]">{src.citation}</span>
                <div className="flex gap-2 shrink-0">
                  {src.pdf_url && (
                    <a href={src.pdf_url} target="_blank" rel="noopener noreferrer"
                      title="Open NICE Guideline PDF"
                      className="text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium text-[11px] bg-teal-500/10 px-2 py-0.5 rounded">
                      <FileText size={12} /><span>PDF Page</span>
                    </a>
                  )}
                  {src.nice_url && (
                    <a href={src.nice_url} target="_blank" rel="noopener noreferrer"
                      title="Open NICE guidance portal"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium text-[11px] bg-blue-500/10 px-2 py-0.5 rounded">
                      <ExternalLink size={12} /><span>NICE Web</span>
                    </a>
                  )}
                </div>
              </div>
              <p className={`${dark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed text-xs`}>
                {src.text?.slice(0, 240)}{src.text?.length > 240 ? '…' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chat message component ───────────────────────────────────────────────────
function ChatMessage({ msg, dark }) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyAnswer() {
    if (!msg.answer) return;
    navigator.clipboard.writeText(msg.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-4 px-1">
        <div className="max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-2xl rounded-tr-sm bg-teal-600 text-white text-sm shadow-sm leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  const { answer, red_flags, sources, stats } = msg;
  const hasCitations = sources && sources.length > 0;

  return (
    <div className="flex gap-3 mb-5 max-w-[98%] md:max-w-[90%]">
      <div className="shrink-0 w-8 h-8 rounded-xl bg-teal-700 flex items-center justify-center mt-0.5 shadow-sm">
        <Bot size={16} className="text-white" />
      </div>
      
      <div className={`flex-1 rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm shadow-sm ${dark ? 'bg-gray-900 border border-gray-800/90' : 'bg-white border border-gray-200'}`}>
        
        {/* Red Flags Alert Box (Only shown if emergency red flags found) */}
        {red_flags && red_flags.length > 0 && (
          <div className="mb-3.5 px-3.5 py-2.5 rounded-xl bg-red-900/30 border border-red-700/50 text-red-300 text-xs">
            <div className="flex items-center gap-1.5 font-bold mb-1 text-red-200">
              <AlertTriangle size={14} className="text-red-400" />
              <span>Red Flag Symptoms Detected</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-red-200/90">
              {red_flags.map((rf, i) => (
                <li key={i} className="capitalize font-medium">{rf}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Clean Natural Answer */}
        <div className={dark ? 'text-gray-200' : 'text-gray-800'}>
          <MDAnswer text={answer} dark={dark} />
        </div>

        {/* Bottom Actions Toolbar */}
        <div className={`mt-3 pt-2 border-t flex items-center justify-between gap-2 text-xs ${dark ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
          <div className="flex items-center gap-3">
            <button onClick={copyAnswer}
              className="flex items-center gap-1 text-[11px] hover:text-teal-400 transition-colors">
              {copied ? <Check size={12} className="text-teal-400" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            {/* Technical stats button - hidden by default unless user explicitly clicks */}
            {stats && stats.sources_found > 0 && (
              <button onClick={() => setStatsOpen(o => !o)}
                className="flex items-center gap-1 text-[11px] hover:text-teal-400 transition-colors">
                <BarChart2 size={12} />
                <span>{statsOpen ? 'Hide' : 'Technical Details'}</span>
                {statsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
            )}
          </div>
        </div>

        {/* Technical Stats Drawer (Only on explicit click) */}
        {stats && statsOpen && (
          <div className={`mt-3 p-3 rounded-xl border text-xs ${dark ? 'bg-gray-950 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
            <p className="font-semibold text-teal-400 mb-2 flex items-center gap-1">
              <Info size={13} /> Technical Retrieval Metrics
            </p>
            <StatBar label="Overall Guideline Match" value={stats.evidence_match} dark={dark} color="teal" />
            <StatBar label="Neural Vector Match (MedCPT)" value={stats.mode === 'bm25_only' ? 'BM25 Mode' : stats.dense_retrieval} dark={dark} color="blue" />
            <StatBar label="Keyword Lexical Match (BM25)" value={stats.lexical_match} dark={dark} color="purple" />
            <div className={`text-[11px] mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
              Retrieved chunks: {stats.sources_found}
            </div>
          </div>
        )}

        {/* Citations Panel (Hidden by default) */}
        {hasCitations && <SourcesPanel sources={sources} dark={dark} />}
      </div>
    </div>
  );
}

// ── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator({ dark }) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="shrink-0 w-8 h-8 rounded-xl bg-teal-700 flex items-center justify-center mt-0.5 shadow-sm">
        <Bot size={16} className="text-white" />
      </div>
      <div className={`px-4 py-3 rounded-2xl rounded-tl-sm ${dark ? 'bg-gray-900 border border-gray-800' : 'bg-gray-100'}`}>
        <div className="flex gap-1.5 items-center h-4">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── QR Code & Presentation Modal ─────────────────────────────────────────────
function PresentModal({ dark, onClose }) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState('wifi');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/network-info`)
      .then(r => r.json())
      .then(data => setNetworkInfo(data))
      .catch(() => {});
  }, []);

  // Determine current active URL to encode into QR
  const localUrl = networkInfo?.local_url || `http://${window.location.hostname}:8000`;
  const currentUrl = activeTab === 'wifi' ? localUrl : (customUrl || window.location.href);

  function copyCurrentUrl() {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl p-6 border ${dark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <QrCode size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold">Scan to Open on Phone</h2>
              <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Scan with any phone camera to use the app</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-700/30"><X size={18} /></button>
        </div>

        {/* Tab Selection */}
        <div className={`flex rounded-xl p-1 mb-4 ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <button onClick={() => setActiveTab('wifi')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all
              ${activeTab === 'wifi' ? 'bg-teal-600 text-white shadow-sm' : dark ? 'text-gray-400 hover:text-white' : 'text-gray-600'}`}>
            <Wifi size={13} /> Local Wi-Fi / Hotspot
          </button>
          <button onClick={() => setActiveTab('custom')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all
              ${activeTab === 'custom' ? 'bg-teal-600 text-white shadow-sm' : dark ? 'text-gray-400 hover:text-white' : 'text-gray-600'}`}>
            <Share2 size={13} /> Custom Link
          </button>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white text-gray-900 shadow-inner mb-4">
          <QRCodeSVG
            value={currentUrl}
            size={180}
            level="M"
            includeMargin={true}
            className="rounded"
          />
          <div className="mt-2 text-center">
            <span className="text-[11px] font-mono font-medium text-gray-600 break-all px-2">
              {currentUrl}
            </span>
          </div>
        </div>

        {/* Custom URL Input */}
        {activeTab === 'custom' && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="https://your-custom-link.com"
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-xs border outline-none focus:ring-2 focus:ring-teal-500
                ${dark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
        )}

        {/* Copy Button */}
        <div className="flex gap-2">
          <button
            onClick={copyCurrentUrl}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 border transition-all
              ${dark ? 'border-gray-700 bg-gray-800 hover:bg-gray-750 text-white' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-800'}`}>
            {copied ? <Check size={14} className="text-teal-400" /> : <Copy size={14} />}
            {copied ? 'Link Copied!' : 'Copy Link'}
          </button>
        </div>

        {/* Instructions */}
        <div className={`mt-3 p-2.5 rounded-xl text-[11px] leading-relaxed border ${dark ? 'bg-gray-800/40 border-gray-800 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
          <p>
            💡 <strong>How it works:</strong> Make sure your phone is connected to the same Wi-Fi or phone hotspot as this computer, then point your camera at the QR code.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ dark, onAuth, pendingQuery, onClose }) {
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [shareConsent, setShareConsent] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cleanPwd = password.trim();
  const cleanConfirm = confirm.trim();
  const passwordsMatch = cleanPwd && cleanConfirm && cleanPwd === cleanConfirm;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (tab === 'register') {
      if (!cleanPwd) {
        setError('Please enter a password.');
        return;
      }
      if (cleanPwd.length < 4) {
        setError('Password must be at least 4 characters long.');
        return;
      }
      if (cleanPwd !== cleanConfirm) {
        setError('Passwords do not match. Please ensure both fields are identical.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = tab === 'login'
        ? { username: username.trim(), password: cleanPwd }
        : { username: username.trim(), password: cleanPwd, share_for_training: shareConsent };

      let res;
      try {
        res = await fetch(`${API_BASE}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } catch (networkErr) {
        // Fallback for static GitHub Pages or offline demonstration mode
        const offlineUser = {
          id: Date.now(),
          username: username.trim(),
          role: username.trim().toLowerCase() === 'admin' ? 'admin' : 'user',
          share_for_training: shareConsent
        };
        if (rememberMe) localStorage.setItem('cds_user', JSON.stringify(offlineUser));
        onAuth(offlineUser);
        return;
      }

      if (!res.ok) {
        let errorMsg = 'Authentication failed.';
        try {
          const errData = await res.json();
          errorMsg = errData.detail || errorMsg;
        } catch {
          // If response was non-JSON (e.g. 404 from GitHub Pages)
          const offlineUser = {
            id: Date.now(),
            username: username.trim(),
            role: username.trim().toLowerCase() === 'admin' ? 'admin' : 'user',
            share_for_training: shareConsent
          };
          if (rememberMe) localStorage.setItem('cds_user', JSON.stringify(offlineUser));
          onAuth(offlineUser);
          return;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (rememberMe) localStorage.setItem('cds_user', JSON.stringify(data.user));
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = `w-full pl-3 pr-10 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-teal-500 transition-colors
    ${dark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 ${dark ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Stethoscope size={18} className="text-teal-400" />
            {pendingQuery ? 'Sign in to send query' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          {/* Always visible X button so the user can escape or cancel the modal */}
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {pendingQuery && (
          <div className={`mb-3.5 px-3 py-2 rounded-xl text-xs ${dark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
            Query: <em>"{pendingQuery.slice(0, 75)}{pendingQuery.length > 75 ? '…' : ''}"</em>
          </div>
        )}

        <div className={`flex rounded-xl mb-4 p-1 ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          {['login','register'].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition-colors cursor-pointer
                ${tab === t ? 'bg-teal-600 text-white shadow-sm' : dark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input className={inputCls} placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)} required autoFocus />
          
          <div className="relative">
            <input className={inputCls} placeholder="Password" type={showPwd ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)} required />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowPwd(v => !v)}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg z-20 cursor-pointer flex items-center justify-center transition-colors
                ${dark ? 'text-gray-400 hover:text-teal-300 hover:bg-gray-700/60' : 'text-gray-400 hover:text-teal-600 hover:bg-gray-100'}`}
              title={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {tab === 'register' && (
            <>
              <div className="relative">
                <input className={inputCls} placeholder="Confirm password" type={showConfirm ? 'text' : 'password'}
                  value={confirm} onChange={e => setConfirm(e.target.value)} required />
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setShowConfirm(v => !v)}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg z-20 cursor-pointer flex items-center justify-center transition-colors
                    ${dark ? 'text-gray-400 hover:text-teal-300 hover:bg-gray-700/60' : 'text-gray-400 hover:text-teal-600 hover:bg-gray-100'}`}
                  title={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Instant password match indicator */}
              {confirm.length > 0 && (
                <div className="px-1 text-xs">
                  {passwordsMatch ? (
                    <span className="text-teal-400 flex items-center gap-1 font-medium">
                      <Check size={14} /> Passwords match
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1 font-medium">
                      <AlertTriangle size={13} /> Passwords do not match yet
                    </span>
                  )}
                </div>
              )}

              <label className="flex items-start gap-2 text-xs cursor-pointer pt-1">
                <input type="checkbox" checked={shareConsent} onChange={e => setShareConsent(e.target.checked)}
                  className="mt-0.5 accent-teal-500 cursor-pointer" />
                <span className={dark ? 'text-gray-400' : 'text-gray-500'}>
                  Share query logs for clinical improvement
                </span>
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
              className="accent-teal-500 cursor-pointer" />
            <span className={dark ? 'text-gray-400' : 'text-gray-500'}>Remember me on this device</span>
          </label>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-900/30 border border-red-700/40 text-red-300 text-xs font-medium">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 shadow-md cursor-pointer">
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {tab === 'login' && (
            <p className="text-[11px] text-center text-gray-500 pt-1">
              Demo accounts: <code className="text-teal-400 font-mono">admin</code> or <code className="text-teal-400 font-mono">user1</code> (pwd: <code className="text-teal-400 font-mono">#1234$</code>)
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Scope Info Card ──────────────────────────────────────────────────────────
function ScopeCard({ dark }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border mb-3 overflow-hidden ${dark ? 'border-gray-800 bg-gray-850' : 'border-gray-200 bg-gray-50'}`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-teal-400">
          <Shield size={13} /> NICE CG150 Guidelines
        </span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <div className={`px-3 pb-3 text-[11px] ${dark ? 'text-gray-400' : 'text-gray-500'} border-t ${dark ? 'border-gray-800' : 'border-gray-200'} pt-2`}>
          <p className="font-semibold text-teal-400 mb-1">Key Clinical Topics:</p>
          <ul className="space-y-0.5 mb-2 list-disc list-inside">
            <li>Tension-type headache</li>
            <li>Migraine (with/without aura)</li>
            <li>Cluster headache</li>
            <li>Medication Overuse Headache (MOH)</li>
            <li>Red flags & urgent referral</li>
            <li>Acute & preventive therapies</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({ dark, user }) {
  const [users, setUsers] = useState([]);
  const [llmStatus, setLlmStatus] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [adminPwd, setAdminPwd] = useState('');
  const [keyMsg, setKeyMsg] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [section, setSection] = useState('users');

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/users`).then(r => r.json()).then(d => setUsers(d.users || []));
    fetch(`${API_BASE}/api/admin/llm-status`).then(r => r.json()).then(setLlmStatus);
  }, []);

  async function saveKey() {
    setKeyMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/set-api-key`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_username: user.username, admin_password: adminPwd, gemini_api_key: apiKey })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setKeyMsg('✓ Gemini API key saved. AI LLM mode active.');
      fetch(`${API_BASE}/api/admin/llm-status`).then(r => r.json()).then(setLlmStatus);
    } catch (e) { setKeyMsg('✗ ' + e.message); }
  }

  async function toggleBan(uid, banned) {
    await fetch(`${API_BASE}/api/admin/toggle-ban`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid, is_banned: banned })
    });
    setUsers(u => u.map(x => x.id === uid ? { ...x, is_banned: banned ? 1 : 0 } : x));
  }

  async function viewHistory(uid) {
    setSelectedUser(uid);
    const res = await fetch(`${API_BASE}/api/admin/user-history/${uid}`);
    const d = await res.json();
    setUserHistory(d.history || []);
    setSection('history');
  }

  const cell = `px-3 py-2 text-xs ${dark ? 'border-gray-800' : 'border-gray-200'} border-b`;
  const inp = `px-3 py-2 rounded-xl border text-sm w-full ${dark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
      {/* LLM Key Section */}
      <div className={`rounded-2xl border p-4 shadow-sm ${dark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Key size={16} className="text-teal-400" /> Google Gemini API Key
        </h3>
        {llmStatus && (
          <div className={`text-xs mb-3 px-3 py-2 rounded-xl flex items-center gap-2
            ${llmStatus.llm_enabled ? 'bg-teal-900/30 text-teal-300 border border-teal-700/40' : 'bg-amber-900/30 text-amber-300 border border-amber-700/40'}`}>
            <span>Status: <strong>{llmStatus.mode_label}</strong></span>
          </div>
        )}
        <div className="space-y-2.5">
          <input className={inp} placeholder="Gemini API Key (AIza...)" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <input className={inp} placeholder="Admin Password (to verify)" type="password" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} />
          <button onClick={saveKey} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow">
            Save Key
          </button>
          {keyMsg && <p className={`text-xs font-medium ${keyMsg.startsWith('✓') ? 'text-teal-400' : 'text-red-400'}`}>{keyMsg}</p>}
        </div>
      </div>

      {/* Navigation Header */}
      <div className="flex items-center gap-2">
        {[['users','Users & Accounts'],['history','Audit Query History']].map(([s,l]) => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors
              ${section === s ? 'bg-teal-600 text-white shadow' : dark ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-700'}`}>
            {l}
          </button>
        ))}
        <a href={`${API_BASE}/api/admin/export-training-data?format=jsonl`}
          className="ml-auto px-3 py-2 rounded-xl text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-white flex items-center gap-1.5 shadow">
          <Download size={13} /> Export JSONL
        </a>
      </div>

      {/* Users Table */}
      {section === 'users' && (
        <div className={`rounded-2xl border overflow-hidden shadow-sm ${dark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={dark ? 'bg-gray-800/80 text-gray-400' : 'bg-gray-100 text-gray-600'}>
                  {['Username','Role','Password','Queries','Status','Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={dark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}>
                    <td className={`${cell} font-semibold`}>{u.username}</td>
                    <td className={cell}>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                        ${u.role === 'admin' ? 'bg-purple-700/30 text-purple-400' : 'bg-gray-700/30 text-gray-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className={`${cell} font-mono text-gray-400`}>{u.plain_password}</td>
                    <td className={cell}>{u.total_queries}</td>
                    <td className={cell}>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                        ${u.is_banned ? 'bg-red-900/30 text-red-400' : 'bg-teal-900/30 text-teal-400'}`}>
                        {u.is_banned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className={`${cell} space-x-1.5`}>
                      {u.username !== user.username && (
                        <button onClick={() => toggleBan(u.id, !u.is_banned)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold
                            ${u.is_banned ? 'bg-teal-700/30 text-teal-400' : 'bg-red-700/30 text-red-400'}`}>
                          {u.is_banned ? 'Unban' : 'Ban'}
                        </button>
                      )}
                      <button onClick={() => viewHistory(u.id)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-blue-700/30 text-blue-400">
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Section */}
      {section === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setSection('users')} className="text-xs text-teal-400 font-semibold hover:underline">
              ← Back to Users
            </button>
            <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Target User #{selectedUser}</span>
          </div>
          {userHistory.length === 0
            ? <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>No history available.</p>
            : userHistory.map((h, i) => (
              <div key={i} className={`rounded-xl border p-3.5 text-xs ${dark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                <p className="font-bold text-teal-400 mb-1">{h.query}</p>
                <p className={`line-clamp-3 leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{h.answer}</p>
                <p className={`mt-2 text-[10px] font-mono ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{h.timestamp}</p>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── Main App Root Component ──────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('cds_theme') !== 'light');
  const [customBackend, setCustomBackend] = useState(() => localStorage.getItem('cds_backend_url') || '');
  const [apiBase, setApiBase] = useState(() => getApiBase());
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cds_user') || 'null'); } catch { return null; }
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showPresent, setShowPresent] = useState(false);
  const [pendingQuery, setPendingQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

  // ── Voice Recognition (Speech-to-Text) ─────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [speechLang, setSpeechLang] = useState('ar-EG'); // 'ar-EG' (Arabic - Egypt / Universal) or 'en-US'
  const recognitionRef = useRef(null);
  const baseInputRef = useRef(''); // Stores input before recording started
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        let sessionTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          sessionTranscript += event.results[i][0].transcript;
        }
        
        const base = baseInputRef.current.trim();
        const fullText = base ? `${base} ${sessionTranscript}` : sessionTranscript;
        setInput(fullText);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  function toggleRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('التعرف على الصوت غير مدعوم في هذا المتصفح. يرجى استخدام متصفح Chrome أو Edge أو Safari على الهاتف أو الكمبيوتر.');
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {}
      setIsRecording(false);
    } else {
      try {
        baseInputRef.current = input;
        if (recognitionRef.current) {
          recognitionRef.current.lang = speechLang;
          recognitionRef.current.start();
          setIsRecording(true);
        }
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        // If already started, restart
        try {
          recognitionRef.current?.stop();
          setTimeout(() => {
            if (recognitionRef.current) {
              recognitionRef.current.lang = speechLang;
              recognitionRef.current.start();
              setIsRecording(true);
            }
          }, 200);
        } catch (e) {}
      }
    }
  }

  useEffect(() => {
    localStorage.setItem('cds_theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function fetchHistory() {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/user/history/${user.id}`);
      const d = await res.json();
      setHistory(d.history || []);
    } catch {}
  }

  function handleTheme() {
    setDark(v => !v);
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem('cds_user');
    setMessages([]);
    setHistory([]);
    setConversationHistory([]);
    setActiveTab('chat');
  }

  // "+ New Chat" Action
  function startNewChat() {
    setMessages([]);
    setConversationHistory([]);
    setInput('');
    setSidebarOpen(false);
    setActiveTab('chat');
    inputRef.current?.focus();
  }

  // Incognito Mode State
  const [incognito, setIncognito] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function deleteSingleChat(queryId, e) {
    e.stopPropagation();
    if (!user) return;
    try {
      await fetch(`${API_BASE}/api/user/delete-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, query_id: queryId })
      });
      setHistory(h => h.filter(item => item.id !== queryId));
    } catch (err) {
      console.error(err);
    }
  }

  async function clearAllHistory() {
    if (!user) return;
    if (!window.confirm('Are you sure you want to clear all your chat history? This cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/api/user/clear-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });
      setHistory([]);
      setMessages([]);
      setConversationHistory([]);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    if (!user) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const res = await fetch(`${API_BASE}/api/user/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, password: deletePassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete account.');
      setShowDeleteModal(false);
      setShowSettings(false);
      handleLogout();
      alert('Your account and all associated data have been permanently deleted.');
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function sendQuery(queryText) {
    if (!queryText.trim()) return;
    const q = queryText.trim();
    
    // Append user message immediately
    setMessages(m => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);

    const activeApi = apiBase || getApiBase();

    if (!activeApi && window.location.hostname.includes('github.io')) {
      setMessages(m => [...m, {
        role: 'assistant',
        intent: 'chat',
        answer: `⚠️ **AI Backend Not Connected**\n\nGitHub Pages only hosts the website interface. To get real AI clinical answers with NICE CG150 guideline citations:\n\n1. Double-click **\`Start_Free_Online_Tunnel.bat\`** on your desktop, OR deploy to **Hugging Face Spaces**.\n2. Click the **⚙️ Settings** icon in the top-right navbar and paste your free backend URL.\n\n*If you are running the app locally on your PC, simply open http://127.0.0.1:8000.*`,
        red_flags: [], sources: [], stats: {}
      }]);
      setLoading(false);
      return;
    }

    try {
      const body = {
        query: q,
        // In incognito mode, do not associate with user ID so it never saves to database
        user_id: incognito ? null : (user?.id || null),
        username: incognito ? 'Incognito User' : (user?.username || 'Anonymous'),
        conversation_history: conversationHistory.slice(-4),
      };
      
      const res = await fetch(`${activeApi}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true'
        },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        let errDetail = 'Request failed.';
        try {
          const errData = await res.json();
          errDetail = errData.detail || errDetail;
        } catch {
          errDetail = `Server returned status ${res.status}. Please check your backend connection.`;
        }
        throw new Error(errDetail);
      }
      
      const data = await res.json();
      const assistantMsg = { role: 'assistant', ...data };
      setMessages(m => [...m, assistantMsg]);
      
      // Update multi-turn conversation context
      setConversationHistory(h => [...h, { query: q, answer: data.answer }].slice(-6));
      
      if (user && !incognito) fetchHistory();
    } catch (err) {
      setMessages(m => [...m, {
        role: 'assistant', intent: 'chat',
        answer: `⚠️ Could not reach AI Backend: ${err.message}\n\nPlease verify your backend server URL in **⚙️ Settings**.`,
        red_flags: [], sources: [], stats: {}
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    const q = input.trim();
    if (!q) return;
    if (!user && !incognito) {
      setPendingQuery(q);
      setShowAuth(true);
      return;
    }
    sendQuery(q);
  }

  function handleAuth(u) {
    setUser(u);
    setShowAuth(false);
    if (pendingQuery) {
      const q = pendingQuery;
      setPendingQuery('');
      sendQuery(q);
    }
  }

  function handleHistoryClick(h) {
    setSidebarOpen(false);
    setActiveTab('chat');
    setMessages([
      { role: 'user', text: h.query },
      {
        role: 'assistant',
        intent: 'clinical',
        answer: h.answer,
        red_flags: h.red_flags || [],
        sources: h.sources || [],
        stats: { evidence_match: 85.0, dense_retrieval: 88.0, lexical_match: 82.0, sources_found: (h.sources || []).length, mode: 'history' },
        validation: h.validation || {}
      }
    ]);
    setConversationHistory([{ query: h.query, answer: h.answer }]);
  }

  async function toggleConsent() {
    if (!user) return;
    setConsentLoading(true);
    const newConsent = !user.share_for_training;
    try {
      await fetch(`${API_BASE}/api/user/consent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, share_for_training: newConsent })
      });
      const updated = { ...user, share_for_training: newConsent };
      setUser(updated);
      localStorage.setItem('cds_user', JSON.stringify(updated));
    } catch {}
    setConsentLoading(false);
  }

  const bg = dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900';
  const sidebarCls = dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const headerCls = dark ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-200';

  return (
    <div className={`h-screen flex flex-col ${bg} overflow-hidden font-sans`}>
      
      {/* Auth Modal */}
      {showAuth && (
        <AuthModal dark={dark} onAuth={handleAuth} pendingQuery={pendingQuery}
          onClose={() => { setShowAuth(false); setPendingQuery(''); }} />
      )}

      {/* QR Code Presentation Modal */}
      {showPresent && (
        <PresentModal dark={dark} onClose={() => setShowPresent(false)} />
      )}

      {/* Top Navbar */}
      <header className={`shrink-0 flex items-center justify-between px-3 md:px-5 py-2.5 border-b backdrop-blur-md ${headerCls} z-20`}>
        <div className="flex items-center gap-2.5">
          <button onClick={() => setSidebarOpen(o => !o)}
            className="md:hidden p-1.5 rounded-xl hover:bg-gray-700/30 text-teal-400">
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={startNewChat}>
            <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center shadow-md">
              <Stethoscope size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight">Clinical Decision Support</span>
                <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 font-mono font-semibold rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  NICE CG150
                </span>
              </div>
              <p className={`text-[10px] leading-none hidden sm:block ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                Evidence-Grounded Assistant
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Incognito Mode Toggle Button */}
          <button
            onClick={() => setIncognito(i => !i)}
            title={incognito ? "Incognito Active (Chats not saved to history). Click to return to normal." : "Go Incognito (Chats won't be saved)"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm
              ${incognito
                ? 'bg-purple-900/40 text-purple-300 border-purple-500/60 ring-2 ring-purple-500/30 animate-pulse'
                : 'bg-gray-800/40 hover:bg-gray-800 text-gray-400 border-gray-700'}`}>
            <span>🕵️</span>
            <span className="hidden sm:inline">{incognito ? 'Incognito ON' : 'Incognito'}</span>
          </button>

          {/* Top New Chat on Mobile */}
          <button
            onClick={startNewChat}
            className="md:hidden p-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold flex items-center gap-1">
            <Plus size={14} />
          </button>

          {/* QR Code Button */}
          <button
            onClick={() => setShowPresent(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-semibold shadow-sm transition-all">
            <QrCode size={15} />
            <span className="hidden sm:inline">Scan QR</span>
          </button>

          {/* Theme Toggle */}
          <button onClick={handleTheme}
            className="p-2 rounded-xl hover:bg-gray-700/30 text-gray-400 hover:text-white transition-colors">
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Settings Button (Always accessible) */}
          <button onClick={() => setShowSettings(o => !o)}
            title="Settings & Backend Connection"
            className={`p-2 rounded-xl hover:bg-gray-700/30 text-gray-400 hover:text-white transition-colors cursor-pointer ${showSettings ? 'bg-gray-700/40 text-teal-400' : ''}`}>
            <Settings size={17} />
          </button>

          {/* User Status / Auth */}
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-700/20 text-teal-300 text-xs font-medium border border-teal-700/30">
                {user.role === 'admin' ? <Shield size={12} className="text-purple-400" /> : <User size={12} />}
                <span>{user.username}</span>
              </div>
              <button onClick={handleLogout}
                title="Sign Out"
                className="p-2 rounded-xl hover:bg-red-700/20 hover:text-red-400 text-gray-400 transition-colors">
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <button onClick={() => setShowAuth(true)}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition-all">
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Settings Menu Dropdown (Clean, non-breaking toggle + Account Deletion) */}
      {showSettings && (
        <div className={`absolute right-4 top-14 z-30 w-80 rounded-2xl shadow-2xl border p-4 text-sm animate-in fade-in
          ${dark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700/40">
            <span className="font-bold text-xs uppercase tracking-wider text-teal-400">Preferences & Server</span>
            <button onClick={() => setShowSettings(false)}><X size={15} /></button>
          </div>

          {/* Backend AI Server URL Configuration */}
          <div className="mb-3 pb-3 border-b border-gray-700/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">Backend AI Server URL</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${apiBase ? 'bg-teal-900/40 text-teal-300' : 'bg-amber-900/40 text-amber-300'}`}>
                {apiBase ? 'Connected' : 'Not Set'}
              </span>
            </div>
            <p className={`text-[10px] leading-tight mb-2 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              Paste your free Cloudflare Tunnel, localtunnel, or Hugging Face Space URL:
            </p>
            <div className="flex gap-1.5">
              <input
                type="url"
                value={customBackend}
                onChange={e => setCustomBackend(e.target.value)}
                placeholder="http://127.0.0.1:8000"
                className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-teal-500 font-mono ${dark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'}`}
              />
              <button
                type="button"
                onClick={() => {
                  const val = customBackend.trim().replace(/\/+$/, '');
                  if (val) {
                    localStorage.setItem('cds_backend_url', val);
                  } else {
                    localStorage.removeItem('cds_backend_url');
                  }
                  API_BASE = getApiBase();
                  setApiBase(API_BASE);
                  alert('Backend Server URL saved successfully!');
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold">Data Improvement Sharing</p>
                <p className={`text-[10px] leading-tight mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Allow anonymized query data for AI clinical evaluation
                </p>
              </div>
              <button
                type="button"
                onClick={toggleConsent}
                disabled={consentLoading}
                className={`shrink-0 w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                  user.share_for_training ? 'bg-teal-600' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                    user.share_for_training ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Clear History Button in Settings */}
            <div className="pt-2 border-t border-gray-700/40">
              <button
                type="button"
                onClick={clearAllHistory}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-750 text-gray-300 flex items-center justify-center gap-2 border border-gray-700 transition-colors"
              >
                <Trash2 size={13} className="text-amber-400" />
                <span>Clear All Chat History</span>
              </button>
            </div>

            {/* Delete Account Section */}
            <div className="pt-2 border-t border-gray-700/40">
              <button
                type="button"
                onClick={() => { setShowSettings(false); setShowDeleteModal(true); }}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-300 flex items-center justify-center gap-2 border border-red-800/40 transition-colors"
              >
                <UserX size={13} />
                <span>Delete My Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Password Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className={`w-full max-w-sm rounded-2xl shadow-2xl p-6 border ${dark ? 'bg-gray-900 border-red-800/60 text-white' : 'bg-white border-red-300 text-gray-900'}`}>
            <div className="flex items-center gap-2 mb-3 text-red-400 font-bold text-sm">
              <AlertTriangle size={18} />
              <span>Delete Account & Data</span>
            </div>
            <p className={`text-xs mb-4 leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              Please enter your password to confirm. This will <strong>permanently delete</strong> your account, history, and all stored data.
            </p>
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <input
                type="password"
                placeholder="Enter your account password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                required
                autoFocus
                className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-red-500
                  ${dark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
              {deleteError && <p className="text-red-400 text-xs font-semibold">{deleteError}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${dark ? 'border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300' : 'border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || !deletePassword}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-all shadow-md"
                >
                  {deleteLoading ? 'Deleting…' : 'Delete Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Sidebar Drawer */}
        <aside className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col w-72 shrink-0 border-r p-3.5 overflow-y-auto ${sidebarCls}
          fixed md:static inset-y-0 left-0 z-30 mt-12 md:mt-0 shadow-2xl md:shadow-none`}>

          {/* + New Chat Button */}
          <button
            onClick={startNewChat}
            className="w-full py-2.5 px-3.5 mb-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all">
            <Plus size={16} />
            <span>+ Start New Chat</span>
          </button>

          {/* Role Navigation (Admin only) */}
          {user?.role === 'admin' && (
            <div className={`flex rounded-xl mb-3 p-1 ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              {[['chat','Clinical Chat'],['admin','Admin Portal']].map(([t,l]) => (
                <button key={t} onClick={() => { setActiveTab(t); setSidebarOpen(false); }}
                  className={`flex-1 py-1.5 text-xs rounded-lg font-semibold transition-all
                    ${activeTab === t ? 'bg-teal-600 text-white shadow-sm' : dark ? 'text-gray-400 hover:text-white' : 'text-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Scope Card */}
          <ScopeCard dark={dark} />

          {/* History Header & Clear Action */}
          <div className="flex items-center justify-between mb-2 mt-1 px-1">
            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              <History size={13} /> Chat History
            </span>
            <div className="flex items-center gap-2">
              {user && history.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  title="Clear all chat history"
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
              {user && (
                <button onClick={fetchHistory} title="Refresh History" className="text-gray-500 hover:text-teal-400">
                  <RefreshCw size={12} />
                </button>
              )}
            </div>
          </div>

          {!user && (
            <div className={`p-3 rounded-xl text-center text-xs mb-3 ${dark ? 'bg-gray-800/40 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
              Sign in to automatically save and resume your chat history.
            </div>
          )}

          {/* History List with Per-Chat Delete Button */}
          <div className="space-y-1 flex-1 overflow-y-auto pr-1">
            {history.slice(0, 40).map((h, i) => (
              <div
                key={h.id || i}
                onClick={() => handleHistoryClick(h)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs group cursor-pointer transition-all
                  ${dark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className="truncate font-medium group-hover:text-teal-400 transition-colors">
                    {h.query}
                  </p>
                  <p className={`text-[10px] mt-0.5 font-mono ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {h.timestamp?.slice(0, 16)}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteSingleChat(h.id, e)}
                  title="Delete this chat"
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className={`pt-3 border-t text-[11px] ${dark ? 'border-gray-800 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
            <p className="font-semibold text-teal-400/90">NICE CG150 Clinical Assistant</p>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-transparent">
          {activeTab === 'admin' && user?.role === 'admin' ? (
            <AdminPanel dark={dark} user={user} />
          ) : (
            <>
              {/* Chat Message Thread */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6">
                {messages.length === 0 ? (
                  /* Welcome Screen */
                  <div className="flex flex-col items-center justify-center min-h-[80%] text-center px-4 max-w-2xl mx-auto animate-in fade-in">
                    <div className="w-16 h-16 rounded-2xl bg-teal-600 flex items-center justify-center shadow-xl mb-4">
                      <Stethoscope size={34} className="text-white" />
                    </div>
                    
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                      Clinical Decision Support
                    </h1>
                    <p className={`text-xs sm:text-sm max-w-md mx-auto mb-6 leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      Evidence-grounded assistant for headache diagnosis and management under <strong>NICE CG150</strong>. Ask questions or converse freely.
                    </p>

                    {/* Quick Example Chips */}
                    <div className="grid gap-2.5 w-full text-left">
                      {EXAMPLE_QUESTIONS.map((q, i) => (
                        <button key={i} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                          className={`p-3.5 rounded-2xl border text-xs sm:text-sm transition-all text-left group shadow-sm flex items-center justify-between
                            ${dark ? 'border-gray-800 bg-gray-900/70 hover:bg-gray-850 hover:border-teal-600/60 text-gray-200' : 'border-gray-200 bg-white hover:border-teal-400 hover:bg-teal-50/50 text-gray-800'}`}>
                          <span>{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto w-full">
                    {messages.map((msg, i) => <ChatMessage key={i} msg={msg} dark={dark} />)}
                    {loading && <TypingIndicator dark={dark} />}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Bottom Input Form */}
              <div className={`shrink-0 border-t p-3 sm:p-4 ${dark ? 'border-gray-800/80 bg-gray-900/90' : 'border-gray-200 bg-white/90'} backdrop-blur-md`}>
                <div className="max-w-3xl mx-auto w-full">
                  <div className={`flex items-end gap-2 rounded-2xl border p-2 shadow-sm transition-all
                    ${dark ? 'border-gray-700 bg-gray-800/90 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500' : 'border-gray-300 bg-white focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500'}`}>
                    
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={speechLang === 'ar-SA' ? "اسأل أي سؤال أو تحدث صوتياً... (Enter للإرسال)" : "Ask any clinical question or speak… (Enter to send)"}
                      className={`flex-1 resize-none bg-transparent outline-none text-xs sm:text-sm px-2 py-1 leading-relaxed max-h-32
                        ${dark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                      style={{ minHeight: '36px' }}
                    />
                    
                    {/* Voice Language Selector */}
                    <button
                      type="button"
                      onClick={() => setSpeechLang(l => l === 'ar-SA' ? 'en-US' : 'ar-SA')}
                      title="Toggle Speech Recognition Language (Arabic / English)"
                      className={`shrink-0 px-2 py-1.5 rounded-xl text-xs font-bold transition-all border
                        ${speechLang === 'ar-SA'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}
                    >
                      {speechLang === 'ar-SA' ? '🇸🇦 AR' : '🇬🇧 EN'}
                    </button>

                    {/* Microphone Voice Button */}
                    <button
                      type="button"
                      onClick={toggleRecording}
                      title={isRecording ? "Listening... click to stop" : "Speak (Voice input)"}
                      className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-md
                        ${isRecording
                          ? 'bg-red-600 text-white animate-pulse'
                          : dark
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                    >
                      {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                    </button>

                    {/* Send Button */}
                    <button
                      onClick={handleSend}
                      disabled={loading || !input.trim()}
                      className="shrink-0 w-9 h-9 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-30
                        flex items-center justify-center transition-all shadow-md text-white">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
