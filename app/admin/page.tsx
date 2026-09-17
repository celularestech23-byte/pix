'use client';

import { useState, useEffect, useRef } from 'react';

interface UserRow {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  coins: number;
  balance: number;
  created_at: string;
}

interface WithdrawalRow {
  id: string;
  amount: number;
  pix_key: string;
  cpf: string;
  status: string;
  created_at: string;
  users: { name: string } | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  coins_qty: number;
  status: string;
  created_at: string;
  mp_payment_id: string | null;
  users: { name: string } | null;
}

/* ── Gera token admin básico ── */
function makeAdminToken(user: string, pass: string) {
  return btoa(`${user}:${pass}`);
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [token, setToken] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [tab, setTab] = useState<'dashboard' | 'users' | 'withdrawals' | 'payments' | 'config'>('dashboard');

  // Data
  const [users, setUsers] = useState<UserRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);

  // Config
  const [cfgTitle, setCfgTitle] = useState('');
  const [cfgPrize, setCfgPrize] = useState('');
  const [cfgParticipants, setCfgParticipants] = useState('');
  const [cfgForced, setCfgForced] = useState('');
  const [cfgCardTitles, setCfgCardTitles] = useState(['', '', '']);
  const [cfgCardImgs, setCfgCardImgs] = useState(['', '', '']);
  const [cfgMpAccessToken, setCfgMpAccessToken] = useState('');
  const [cfgMpWebhookSecret, setCfgMpWebhookSecret] = useState('');

  // Gerenciamento de itens da roleta
  const [newItem, setNewItem] = useState('');
  const [newItemType, setNewItemType] = useState<'name' | 'value'>('value');
  const newItemRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ─────── LOGIN ─────── */
  function handleLogin() {
    if (!adminUser.trim() || !adminPass.trim()) { setLoginErr('Preencha os campos.'); return; }
    const t = makeAdminToken(adminUser, adminPass);
    setToken(t);
    setAuthed(true);
    loadAll(t);
  }

  /* ─────── LOAD DATA ─────── */
  async function loadAll(tk: string) {
    setLoading(true);
    await Promise.all([loadUsers(tk), loadPayments(tk), loadConfig(tk), loadWithdrawals(tk)]);
    setLoading(false);
  }

  async function loadUsers(tk: string) {
    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${tk}` } });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setTotalUsers(data.total);
    }
  }

  async function loadWithdrawals(tk: string) {
    const res = await fetch('/api/admin/withdrawals', { headers: { Authorization: `Bearer ${tk}` } });
    if (res.ok) {
      const data = await res.json();
      setWithdrawals(data);
    }
  }

  async function loadPayments(tk: string) {
    const res = await fetch('/api/admin/payments', { headers: { Authorization: `Bearer ${tk}` } });
    if (res.ok) {
      const data = await res.json();
      setPayments(data.payments);
      setTotalPayments(data.total);
    }
  }

  async function loadConfig(tk: string) {
    const res = await fetch('/api/admin/config', { headers: { Authorization: `Bearer ${tk}` } });
    if (res.ok) {
      const data = await res.json();
      setCfgTitle(data.title ?? '');
      setCfgPrize(data.prize ?? '');
      setCfgParticipants((data.participants ?? []).join('\n'));
      setCfgForced(data.forced_winner ?? '');
      setCfgCardTitles([data.card1_title ?? '', data.card2_title ?? '', data.card3_title ?? '']);
      setCfgCardImgs([data.card1_img ?? '', data.card2_img ?? '', data.card3_img ?? '']);
      setCfgMpAccessToken(data.mp_access_token ?? '');
      setCfgMpWebhookSecret(data.mp_webhook_secret ?? '');
    }
  }

  async function saveConfig() {
    setSaving(true);
    const participants = cfgParticipants.split('\n').map(s => s.trim()).filter(Boolean);
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: cfgTitle, prize: cfgPrize,
        participants, forcedWinner: cfgForced,
        card1_title: cfgCardTitles[0], card1_img: cfgCardImgs[0],
        card2_title: cfgCardTitles[1], card2_img: cfgCardImgs[1],
        card3_title: cfgCardTitles[2], card3_img: cfgCardImgs[2],
        mp_access_token: cfgMpAccessToken,
        mp_webhook_secret: cfgMpWebhookSecret,
      }),
    });
    setSaving(false);
    if (res.ok) alert('✅ Configurações salvas!');
    else alert('❌ Erro ao salvar.');
  }

  function handleCardImg(e: React.ChangeEvent<HTMLInputElement>, i: number) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const newImgs = [...cfgCardImgs];
      newImgs[i] = ev.target?.result as string;
      setCfgCardImgs(newImgs);
    };
    reader.readAsDataURL(file);
  }

  const approvedPayments = payments.filter(p => p.status === 'approved');
  const revenue = approvedPayments.reduce((s, p) => s + Number(p.amount), 0);

  /* ─────── LOGIN SCREEN ─────── */
  if (!authed) return (
    <>
      <div className="bg-scene">
        <div className="orb orb-1" /><div className="orb orb-2" />
      </div>
      <div className="page-wrapper" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: '420px', padding: '24px 16px' }}>
          <div className="modal-box" style={{ position: 'relative', animation: 'none', maxHeight: 'none' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚙️</div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--cyan)' }}>PAINEL ADMIN</h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>PIX DA SORTE — Acesso Restrito</p>
            </div>
            {loginErr && <div className="alert-warning" style={{ marginBottom: '16px' }}>{loginErr}</div>}
            <div className="form-group">
              <label className="form-label">Usuário</label>
              <input className="form-input" type="text" placeholder="admin" value={adminUser} onChange={e => setAdminUser(e.target.value)} />
            </div>
            <div className="form-group mb-20">
              <label className="form-label">Senha</label>
              <input className="form-input" type="password" placeholder="••••••••" value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button className="btn btn-primary" onClick={handleLogin}>🔐 ACESSAR PAINEL</button>
            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '12px' }}>
              🔒 Acesso restrito. Credenciais protegidas.
            </p>
          </div>
        </div>
      </div>
    </>
  );

  /* ─────── ADMIN DASHBOARD ─────── */
  return (
    <>
      <div className="bg-scene">
        <div className="orb orb-1" /><div className="orb orb-2" />
      </div>
      <div className="page-wrapper" style={{ alignItems: 'stretch', paddingBottom: '40px' }}>
        {/* Header */}
        <div style={{
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--cyan)' }}>⚙️ PAINEL ADMIN</h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>PIX DA SORTE — Dashboard</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {loading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Carregando...</span>}
            <button
              onClick={() => loadAll(token)}
              style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--cyan)', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}
            >
              🔄 Atualizar
            </button>
            <a href="/" style={{ background: 'rgba(255,0,153,0.08)', border: '1px solid rgba(255,0,153,0.3)', borderRadius: '8px', color: 'var(--magenta)', padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none' }}>
              ← Sair
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '4px', padding: '12px 16px',
          background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
        }}>
          {(['dashboard', 'users', 'payments', 'config'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: tab === t ? 'rgba(0,245,255,0.15)' : 'transparent',
              color: tab === t ? 'var(--cyan)' : 'var(--text-muted)',
              fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              borderBottom: tab === t ? '2px solid var(--cyan)' : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}>
              {t === 'dashboard' ? '📊 Dashboard' : t === 'users' ? '👥 Usuários' : t === 'payments' ? '💳 Pagamentos' : '⚙️ Configurar'}
            </button>
          ))}
        </div>

        <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '20px 16px' }}>

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {[
                  { label: 'Total Usuários', value: totalUsers.toString(), icon: '👥', color: 'var(--cyan)' },
                  { label: 'Total Pagamentos', value: totalPayments.toString(), icon: '💳', color: 'var(--magenta)' },
                  { label: 'Pagamentos Aprovados', value: approvedPayments.length.toString(), icon: '✅', color: '#22c55e' },
                  { label: 'Receita Total', value: `R$ ${revenue.toFixed(2).replace('.', ',')}`, icon: '💰', color: 'var(--gold)' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'rgba(0,245,255,0.04)', border: '1px solid var(--border)',
                    borderRadius: '16px', padding: '20px 16px',
                    borderTop: `3px solid ${stat.color}`,
                  }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>{stat.icon}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="admin-section">
                <p className="admin-section-title">📋 Últimos Giros Cadastrados</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Veja a aba <strong style={{ color: 'var(--cyan)' }}>Usuários</strong> para histórico completo.
                </p>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
                Total: <strong style={{ color: 'var(--cyan)' }}>{totalUsers}</strong> usuários cadastrados
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Nome', 'CPF', 'Telefone', 'Moedas', 'Saldo', 'Cadastro', 'Ações'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--cyan)', fontWeight: 800, fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.cpf}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{u.phone}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', color: 'var(--gold)', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 800 }}>
                            🪙 {u.coins}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#00FF88', fontWeight: 600 }}>
                          R$ {parseFloat(String(u.balance || 0)).toFixed(2).replace('.', ',')}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                          {new Date(u.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ padding: '10px 12px', display: 'flex', gap: '8px' }}>
                          <button onClick={async () => {
                            const newCoins = prompt('Quantas moedas?', u.coins.toString());
                            if (newCoins) {
                              await fetch(`/api/admin/users/${u.id}`, {
                                method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ coins: newCoins })
                              });
                              loadAll(token);
                            }
                          }} style={{ background: 'var(--cyan)', color: '#000', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>Editar Moedas</button>
                          
                          <button onClick={async () => {
                            if (confirm('Tem certeza que quer excluir este usuário?')) {
                              await fetch(`/api/admin/users/${u.id}`, {
                                method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
                              });
                              loadAll(token);
                            }
                          }} style={{ background: '#FF4466', color: '#FFF', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>Excluir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px', fontSize: '0.85rem' }}>
                    Nenhum usuário cadastrado ainda.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── WITHDRAWALS ── */}
          {tab === 'withdrawals' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
                Total: <strong style={{ color: 'var(--cyan)' }}>{withdrawals.length}</strong> solicitações
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Data', 'Usuário', 'CPF', 'Chave PIX', 'Valor', 'Status', 'Ações'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--cyan)', fontWeight: 800, fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map(w => (
                      <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                          {new Date(w.created_at).toLocaleDateString('pt-BR')} {new Date(w.created_at).toLocaleTimeString('pt-BR')}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 600 }}>{w.users?.name}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{w.cpf}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{w.pix_key}</td>
                        <td style={{ padding: '10px 12px', color: '#00FF88', fontWeight: 600 }}>R$ {parseFloat(String(w.amount)).toFixed(2).replace('.', ',')}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {w.status === 'pending' ? <span style={{ color: '#FFD700' }}>Pendente</span> :
                           w.status === 'approved' ? <span style={{ color: '#00FF88' }}>Pago</span> :
                           <span style={{ color: '#FF4466' }}>Rejeitado</span>}
                        </td>
                        <td style={{ padding: '10px 12px', display: 'flex', gap: '8px' }}>
                          {w.status === 'pending' && (
                            <>
                              <button onClick={async () => {
                                if(confirm('Marcar como pago?')) {
                                  await fetch('/api/admin/withdrawals', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: w.id, status: 'approved' }) });
                                  loadAll(token);
                                }
                              }} style={{ background: '#00FF88', color: '#000', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>Pagar</button>
                              
                              <button onClick={async () => {
                                if(confirm('Rejeitar saque e devolver saldo?')) {
                                  await fetch('/api/admin/withdrawals', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: w.id, status: 'rejected' }) });
                                  loadAll(token);
                                }
                              }} style={{ background: '#FF4466', color: '#FFF', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}>Rejeitar</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {withdrawals.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px', fontSize: '0.85rem' }}>
                    Nenhuma solicitação de saque.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {tab === 'payments' && (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
                Total: <strong style={{ color: 'var(--cyan)' }}>{totalPayments}</strong> pagamentos
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Usuário', 'Moedas', 'Valor', 'Status', 'ID MP', 'Data'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--cyan)', fontWeight: 800, fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 600 }}>{p.users?.name ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--gold)', fontWeight: 800 }}>🪙 {p.coins_qty}</td>
                        <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 700 }}>R$ {Number(p.amount).toFixed(2).replace('.', ',')}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800,
                            background: p.status === 'approved' ? 'rgba(34,197,94,0.15)' : p.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                            color: p.status === 'approved' ? '#22c55e' : p.status === 'failed' ? '#ef4444' : '#eab308',
                            border: `1px solid ${p.status === 'approved' ? 'rgba(34,197,94,0.3)' : p.status === 'failed' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
                          }}>
                            {p.status === 'approved' ? '✅ Aprovado' : p.status === 'failed' ? '❌ Falhou' : '⏳ Pendente'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: '0.68rem' }}>
                          {p.mp_payment_id ?? '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {payments.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px', fontSize: '0.85rem' }}>
                    Nenhum pagamento registrado ainda.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── CONFIG ── */}
          {tab === 'config' && (
            <div>
              <div className="admin-section">
                <p className="admin-section-title">🎡 Roleta</p>
                <div className="form-group">
                  <label className="form-label">Título</label>
                  <input className="form-input mb-10" type="text" value={cfgTitle} onChange={e => setCfgTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prêmio Principal</label>
                  <input className="form-input" type="text" value={cfgPrize} onChange={e => setCfgPrize(e.target.value)} />
                </div>
              </div>


              <div className="admin-section">
                <p className="admin-section-title">📋 Opções da Roleta</p>

                {/* Adicionar novo item */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Tipo do item a adicionar</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <button
                      onClick={() => setNewItemType('value')}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid',
                        borderColor: newItemType === 'value' ? 'var(--gold)' : 'var(--border)',
                        background: newItemType === 'value' ? 'rgba(255,215,0,0.1)' : 'rgba(0,0,0,0.3)',
                        color: newItemType === 'value' ? 'var(--gold)' : 'var(--text-muted)',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.82rem',
                      }}
                    >💰 Valor (R$)</button>
                    <button
                      onClick={() => setNewItemType('name')}
                      style={{
                        flex: 1, padding: '8px', borderRadius: '8px', border: '2px solid',
                        borderColor: newItemType === 'name' ? 'var(--cyan)' : 'var(--border)',
                        background: newItemType === 'name' ? 'rgba(0,245,255,0.1)' : 'rgba(0,0,0,0.3)',
                        color: newItemType === 'name' ? 'var(--cyan)' : 'var(--text-muted)',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.82rem',
                      }}
                    >👤 Nome</button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      ref={newItemRef}
                      className="form-input"
                      type={newItemType === 'value' ? 'number' : 'text'}
                      placeholder={newItemType === 'value' ? 'Ex: 100 (será salvo como R$ 100)' : 'Ex: João Silva'}
                      value={newItem}
                      onChange={e => setNewItem(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = newItem.trim();
                          if (!trimmed) return;
                          const label = newItemType === 'value' ? `R$ ${trimmed}` : trimmed;
                          const current = cfgParticipants.split('\n').map(s => s.trim()).filter(Boolean);
                          if (current.length >= 50) { alert('Máximo de 50 itens atingido!'); return; }
                          if (current.includes(label)) { alert('Item já existe!'); return; }
                          setCfgParticipants([...current, label].join('\n'));
                          setNewItem('');
                          newItemRef.current?.focus();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={() => {
                        const trimmed = newItem.trim();
                        if (!trimmed) return;
                        const label = newItemType === 'value' ? `R$ ${trimmed}` : trimmed;
                        const current = cfgParticipants.split('\n').map(s => s.trim()).filter(Boolean);
                        if (current.length >= 50) { alert('Máximo de 50 itens atingido!'); return; }
                        if (current.includes(label)) { alert('Item já existe!'); return; }
                        setCfgParticipants([...current, label].join('\n'));
                        setNewItem('');
                        newItemRef.current?.focus();
                      }}
                      style={{
                        padding: '0 18px', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, var(--cyan), #0080ff)',
                        color: '#000', fontWeight: 900, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: '1.1rem', whiteSpace: 'nowrap',
                      }}
                    >+</button>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '6px' }}>Enter ou clique + para adicionar. Máx. 50 itens.</p>
                </div>

                {/* Lista de itens atual */}
                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    Itens na roleta — <span style={{ color: 'var(--cyan)' }}>{cfgParticipants.split('\n').filter(s => s.trim()).length}/50</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid var(--border)', minHeight: '60px' }}>
                    {cfgParticipants.split('\n').map(s => s.trim()).filter(Boolean).map((item, idx) => (
                      <div key={idx} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: item.startsWith('R$') ? 'rgba(255,215,0,0.12)' : 'rgba(0,245,255,0.10)',
                        border: `1px solid ${item.startsWith('R$') ? 'rgba(255,215,0,0.35)' : 'rgba(0,245,255,0.3)'}`,
                        borderRadius: '20px', padding: '4px 10px 4px 12px',
                        fontSize: '0.78rem', fontWeight: 700,
                        color: item.startsWith('R$') ? 'var(--gold)' : 'var(--cyan)',
                      }}>
                        {item.startsWith('R$') ? '💰' : '👤'} {item}
                        <button
                          onClick={() => {
                            const current = cfgParticipants.split('\n').map(s => s.trim()).filter(Boolean);
                            const updated = current.filter((_, i) => i !== idx);
                            setCfgParticipants(updated.join('\n'));
                            if (cfgForced === item) setCfgForced('');
                          }}
                          style={{
                            background: 'rgba(255,0,100,0.2)', border: '1px solid rgba(255,0,100,0.4)',
                            borderRadius: '50%', width: '18px', height: '18px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#ff4466', fontSize: '10px', lineHeight: 1,
                            padding: 0,
                          }}
                          title={`Remover "${item}"`}
                        >✕</button>
                      </div>
                    ))}
                    {cfgParticipants.split('\n').filter(s => s.trim()).length === 0 && (
                      <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: 0 }}>Nenhum item adicionado ainda.</p>
                    )}
                  </div>
                </div>

                {/* Edição manual (textarea) */}
                <details style={{ marginBottom: '16px' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', userSelect: 'none', marginBottom: '8px' }}>✏️ Editar lista manualmente (1 item por linha)</summary>
                  <textarea className="textarea-input" rows={6} value={cfgParticipants} onChange={e => { setCfgParticipants(e.target.value); if (!e.target.value.split('\n').map(s=>s.trim()).filter(Boolean).includes(cfgForced)) setCfgForced(''); }} />
                </details>

                {/* Forçar Vencedor */}
                <div className="form-group" style={{
                  background: 'rgba(255,215,0,0.06)',
                  border: '1px solid rgba(255,215,0,0.3)',
                  borderRadius: '12px',
                  padding: '14px',
                }}>
                  <label className="form-label" style={{ color: 'var(--gold)' }}>🎯 Forçar Vencedor (opcional)</label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px', marginTop: '-4px' }}>
                    Quando selecionado, a roleta <strong style={{ color: 'var(--gold)' }}>SEMPRE</strong> para neste item, independente de quem girar.
                  </p>
                  <select
                    className="select-input"
                    value={cfgForced}
                    onChange={e => setCfgForced(e.target.value)}
                    style={{ borderColor: cfgForced ? 'var(--gold)' : 'var(--border)' }}
                  >
                    <option value="">🎲 — Aleatório (normal) —</option>
                    {cfgParticipants.split('\n').map(s => s.trim()).filter(Boolean).map((item, i) => (
                      <option key={i} value={item}>{item.startsWith('R$') ? '💰' : '👤'} {item}</option>
                    ))}
                  </select>
                  {cfgForced && (
                    <div style={{
                      marginTop: '10px', padding: '8px 12px',
                      background: 'rgba(255,215,0,0.1)', borderRadius: '8px',
                      border: '1px solid rgba(255,215,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--gold)', fontWeight: 700 }}>🎯 Forçado: <strong>{cfgForced}</strong></span>
                      <button
                        onClick={() => setCfgForced('')}
                        style={{
                          background: 'rgba(255,0,100,0.2)', border: '1px solid rgba(255,0,100,0.4)',
                          borderRadius: '6px', color: '#ff4466', cursor: 'pointer',
                          fontSize: '0.72rem', padding: '3px 8px', fontFamily: 'inherit',
                        }}
                      >✕ Remover</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-section">
                <p className="admin-section-title">💳 Credenciais Mercado Pago</p>
                <div className="form-group">
                  <label className="form-label">Access Token</label>
                  <input className="form-input mb-10" type="password" value={cfgMpAccessToken} onChange={e => setCfgMpAccessToken(e.target.value)} placeholder="APP_USR-..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Webhook Secret</label>
                  <input className="form-input" type="password" value={cfgMpWebhookSecret} onChange={e => setCfgMpWebhookSecret(e.target.value)} placeholder="Secret do webhook" />
                </div>
              </div>

              <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>
                {saving ? '⏳ Salvando...' : '💾 SALVAR NO SUPABASE'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
