import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  buildAddressLine,
  formatCepInput,
  parseStoredAddress,
} from "./AppExtras.jsx";

const accountCss = `
.account-page{width:100%;max-width:none;display:grid;gap:var(--gap);justify-items:stretch}
.account-page .page-intro{margin-bottom:0;justify-content:flex-start;text-align:left}
.account-page .intro-copy{width:100%}
.account-page .lead{max-width:none;margin-inline:0;white-space:normal}
.account-workspace{display:grid;gap:var(--gap);align-items:stretch;width:100%}
.account-aside{display:grid;gap:var(--gap);align-content:start;min-width:0}
.account-panel{min-width:0;display:grid;align-content:stretch}
.account-profile{
  display:flex;align-items:center;gap:16px;padding:20px 22px;
  background:var(--surface);border:1px solid var(--line);border-radius:18px;width:100%;
}
.account-tabs{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:6px;
  background:var(--cream);border:1px solid var(--line);border-radius:14px;width:100%;
}
.account-tab{
  border:0;background:transparent;color:var(--ink-2);border-radius:10px;
  padding:11px 12px;font:inherit;font-size:.88rem;font-weight:700;cursor:pointer;width:100%;text-align:center;
}
.account-tab:hover{color:var(--orange-dark);background:rgba(255,107,26,.08)}
.account-tab.is-active{background:var(--surface);color:var(--orange-dark);box-shadow:0 1px 0 rgba(31,35,40,.06)}
.account-tab.danger{color:#B91C1C}
.account-tab.danger:hover{color:#991B1B;background:#FEE2E2}
.account-tab.danger.is-active{color:#991B1B;background:#FEE2E2}
html[data-theme="dark"] .account-tab.danger{color:#FCA5A5}
html[data-theme="dark"] .account-tab.danger:hover,
html[data-theme="dark"] .account-tab.danger.is-active{background:#7F1D1D;color:#FECACA}
.account-avatar{width:72px;height:72px;border-radius:50%;object-fit:cover;flex:none}
.account-avatar.fallback{
  display:grid;place-items:center;background:linear-gradient(135deg,var(--orange),var(--yellow));
  color:#fff;font-weight:800;font-size:1.6rem;
}
.account-profile-copy{min-width:0;display:grid;gap:4px}
.account-profile-copy strong{
  font-family:'Bricolage Grotesque',sans-serif;font-size:1.25rem;letter-spacing:-.02em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.account-profile-copy > span{font-size:.9rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.account-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.account-tag{
  display:inline-flex;font-style:normal;font-size:.72rem;font-weight:700;
  padding:4px 9px;border-radius:999px;background:var(--cream);color:var(--ink-2);
}
.account-tag.ok{background:rgba(22,163,74,.12);color:#166534}
html[data-theme="dark"] .account-tag.ok{background:#14532D;color:#86EFAC}
.account-card{
  display:grid;gap:14px;padding:clamp(22px,3vw,28px) clamp(22px,3vw,32px);
  background:var(--surface);border:1px solid var(--line);border-radius:18px;width:100%;
  align-content:start;min-height:100%;
}
.account-card-head{display:grid;gap:4px;margin-bottom:2px}
.account-card-head h3{margin:0;font-size:1.1rem}
.account-card-head p{margin:0;font-size:.9rem;color:var(--muted);line-height:1.4}
.account-fields{display:grid;gap:14px}
.account-field-full{grid-column:1/-1}
.account-rest-head{margin-top:8px;padding-top:14px;border-top:1px solid var(--line)}
.account-cep-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.account-cep-msg{font-size:.85rem;font-weight:500;color:var(--muted);font-style:normal}
.account-card label{
  display:grid;gap:6px;font-size:.75rem;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.04em;
}
.account-card input{
  padding:12px 14px;border-radius:12px;border:1.5px solid var(--line);
  font:inherit;font-size:.95rem;font-weight:500;text-transform:none;letter-spacing:0;
  background:var(--bg);color:var(--ink);width:100%;
}
.account-card input:focus{outline:none;border-color:var(--orange);background:var(--surface)}
.account-hint{
  margin:0;padding:10px 12px;border-radius:12px;background:var(--cream);
  font-size:.85rem;color:var(--muted);line-height:1.45;font-weight:500;
}
.account-hint.danger{background:#FEE2E2;color:#991B1B}
html[data-theme="dark"] .account-hint.danger{background:#7F1D1D;color:#FECACA}
.account-msg{margin:0;font-size:.85rem;font-weight:600}
.account-msg.error{color:#991B1B}
.account-msg.ok{color:#166534}
html[data-theme="dark"] .account-msg.error{color:#FCA5A5}
html[data-theme="dark"] .account-msg.ok{color:#86EFAC}
.account-card .btn-search,
.account-card .btn-danger,
.account-card .about-link{width:fit-content;min-width:180px;margin-top:4px;justify-self:start}
.account-card-danger{border-color:#FECACA}
html[data-theme="dark"] .account-card-danger{border-color:#7F1D1D}
.btn-danger{
  border:0;background:#DC2626;color:#fff;border-radius:12px;
  min-height:42px;padding:0 22px;font:inherit;font-size:.95rem;font-weight:700;cursor:pointer;
}
.btn-danger:hover:not(:disabled){background:#B91C1C}
.btn-danger:disabled{opacity:.55;cursor:not-allowed}
.about-list{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.about-list li{
  display:grid;gap:4px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--bg);
}
.about-list strong{font-size:.9rem}
.about-list span{font-size:.88rem;color:var(--muted);line-height:1.45}
.about-link{
  display:inline-flex;align-items:center;justify-content:center;
  padding:11px 16px;border-radius:12px;border:1.5px solid var(--orange);
  color:var(--orange-dark);text-decoration:none;font-weight:700;font-size:.9rem;
}
.about-link:hover{background:var(--orange);color:#fff}
@media (min-width:860px){
  .account-workspace{
    grid-template-columns:minmax(240px,300px) minmax(0,1fr);
    min-height:min(560px,70vh);
  }
  .account-profile{flex-direction:column;align-items:flex-start;text-align:left}
  .account-profile-copy{width:100%}
  .account-tabs{grid-template-columns:1fr}
  .account-tab{text-align:left;padding:12px 14px}
  .account-fields{grid-template-columns:1fr 1fr}
  .about-list{grid-template-columns:1fr 1fr}
  .account-card .btn-search,
  .account-card .btn-danger,
  .account-card .about-link{min-width:200px}
}
@media (max-width:859px){
  .account-tabs{grid-template-columns:1fr 1fr}
}
`;

/**
 * @param {{ showRestaurant?: boolean }} props
 */
export default function AccountPanel({ showRestaurant = false }) {
  const { user, updateProfile, changePassword, deleteAccount, refresh } = useAuth();
  const navigate = useNavigate();
  const isPartner = Boolean(showRestaurant);

  const [accountTab, setAccountTab] = useState("dados");
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountMsg, setAccountMsg] = useState(null);
  const [accountError, setAccountError] = useState(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [restName, setRestName] = useState("");
  const [restWebsite, setRestWebsite] = useState("");
  const [restCep, setRestCep] = useState("");
  const [restStreet, setRestStreet] = useState("");
  const [restNumber, setRestNumber] = useState("");
  const [restNeighborhood, setRestNeighborhood] = useState("");
  const [restCity, setRestCity] = useState("");
  const [restUf, setRestUf] = useState("");
  const [restLat, setRestLat] = useState(null);
  const [restLng, setRestLng] = useState(null);
  const [restCepLoading, setRestCepLoading] = useState(false);
  const [restCepMsg, setRestCepMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    setAccountName(user.name || "");
    setAccountEmail(user.email || "");
  }, [user]);

  useEffect(() => {
    if (!isPartner) return undefined;
    let cancelled = false;
    fetch("/api/partners/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.restaurant) return;
        const r = data.restaurant;
        setRestName(r.name || "");
        setRestWebsite(r.websiteUrl || "");
        setRestLat(r.lat ?? null);
        setRestLng(r.lng ?? null);
        const parsed = parseStoredAddress(r.address);
        setRestStreet(parsed.street);
        setRestNumber(parsed.number);
        setRestNeighborhood(parsed.neighborhood);
        setRestCity(parsed.city);
        setRestUf(parsed.state);
        setRestCep(parsed.cep);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isPartner, user?.partnerPlaceId]);

  const lookupRestCep = async (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length !== 8) {
      setRestCepMsg("Digite um CEP com 8 dígitos.");
      return;
    }
    setRestCepLoading(true);
    setRestCepMsg("Buscando CEP…");
    try {
      const res = await fetch(`/api/geo/cep?cep=${digits}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "CEP não encontrado");
      const place = data.place || {};
      setRestCep(formatCepInput(place.cep || digits));
      setRestStreet(place.street || "");
      setRestNeighborhood(place.neighborhood || "");
      setRestCity(place.city || "");
      setRestUf(place.state || "");
      if (place.lat != null && place.lng != null) {
        setRestLat(Number(place.lat));
        setRestLng(Number(place.lng));
      }
      setRestCepMsg("Endereço preenchido — confira e corrija se estiver errado.");
    } catch (err) {
      setRestCepMsg(err.message || "Falha ao buscar CEP");
    } finally {
      setRestCepLoading(false);
    }
  };

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setAccountMsg(null);
    setAccountError(null);
    setAccountSaving(true);
    try {
      await updateProfile({ name: accountName, email: accountEmail });
      if (isPartner) {
        const address = buildAddressLine({
          street: restStreet,
          number: restNumber,
          neighborhood: restNeighborhood,
          city: restCity,
          state: restUf,
          cep: restCep,
        });
        const payload = {
          name: restName,
          address,
          websiteUrl: restWebsite,
        };
        if (restLat != null && restLng != null) {
          payload.lat = restLat;
          payload.lng = restLng;
        }
        const res = await fetch("/api/partners/me", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Falha ao salvar dados do restaurante");
        await refresh?.();
      }
      setAccountMsg(isPartner ? "Dados pessoais e do restaurante salvos." : "Dados atualizados.");
    } catch (err) {
      setAccountError(err.message);
    } finally {
      setAccountSaving(false);
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação não confere com a nova senha.");
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordMsg(user?.has_password ? "Senha alterada." : "Senha definida.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const onDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleteSaving(true);
    try {
      await deleteAccount({ confirm: deleteConfirm, password: deletePassword });
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <>
      <style>{accountCss}</style>
      <section className="account-page" aria-label="Minha conta">
        <div className="page-intro">
          <div className="intro-copy">
            <h1>Minha conta</h1>
            <p className="lead">
              {isPartner
                ? "Gerencie seus dados pessoais e as informações do restaurante."
                : "Gerencie seus dados e a senha de acesso."}
            </p>
          </div>
        </div>

        <div className="account-workspace">
          <aside className="account-aside">
            <div className="account-profile">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="account-avatar" referrerPolicy="no-referrer" />
              ) : (
                <span className="account-avatar fallback" aria-hidden="true">
                  {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="account-profile-copy">
                <strong>{user?.name || "Sua conta"}</strong>
                <span>{user?.email}</span>
                <div className="account-tags">
                  {user?.google_id ? <em className="account-tag">Google</em> : null}
                  <em className={`account-tag ${user?.has_password ? "ok" : ""}`}>
                    {user?.has_password ? "Senha ativa" : "Sem senha"}
                  </em>
                  {isPartner ? <em className="account-tag ok">Restaurante</em> : null}
                </div>
              </div>
            </div>

            <div className="account-tabs" role="tablist" aria-label="Seções da conta">
              <button
                type="button"
                role="tab"
                aria-selected={accountTab === "dados"}
                className={`account-tab ${accountTab === "dados" ? "is-active" : ""}`}
                onClick={() => setAccountTab("dados")}
              >
                Dados pessoais
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={accountTab === "senha"}
                className={`account-tab ${accountTab === "senha" ? "is-active" : ""}`}
                onClick={() => setAccountTab("senha")}
              >
                Minha senha
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={accountTab === "sobre"}
                className={`account-tab ${accountTab === "sobre" ? "is-active" : ""}`}
                onClick={() => setAccountTab("sobre")}
              >
                Sobre o app
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={accountTab === "excluir"}
                className={`account-tab danger ${accountTab === "excluir" ? "is-active" : ""}`}
                onClick={() => setAccountTab("excluir")}
              >
                Excluir conta
              </button>
            </div>
          </aside>

          <div className="account-panel">
            {accountTab === "dados" && (
              <form className="account-card" onSubmit={onSaveProfile} role="tabpanel">
                <div className="account-card-head">
                  <h3>Dados pessoais</h3>
                  <p>Atualize nome e e-mail usados no login.</p>
                </div>
                <div className="account-fields">
                  <label>
                    Nome
                    <input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      autoComplete="name"
                      required
                      minLength={2}
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      type="email"
                      value={accountEmail}
                      onChange={(e) => setAccountEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </label>
                </div>

                {isPartner && (
                  <>
                    <div className="account-card-head account-rest-head">
                      <h3>Dados do restaurante</h3>
                      <p>Use o CEP para preencher o endereço. Corrija se algo vier errado.</p>
                    </div>
                    <div className="account-fields">
                      <label className="account-field-full">
                        Nome do restaurante
                        <input
                          value={restName}
                          onChange={(e) => setRestName(e.target.value)}
                          required
                          minLength={2}
                        />
                      </label>
                      <label>
                        CEP
                        <input
                          value={restCep}
                          onChange={(e) => setRestCep(formatCepInput(e.target.value))}
                          onBlur={() => {
                            if (String(restCep).replace(/\D/g, "").length === 8) {
                              lookupRestCep(restCep);
                            }
                          }}
                          inputMode="numeric"
                          placeholder="00000-000"
                          autoComplete="postal-code"
                        />
                      </label>
                      <div className="account-cep-actions">
                        <button
                          type="button"
                          className="btn-nav-light"
                          disabled={restCepLoading}
                          onClick={() => lookupRestCep(restCep)}
                        >
                          {restCepLoading ? "Buscando…" : "Buscar CEP"}
                        </button>
                        {restCepMsg ? <em className="account-cep-msg">{restCepMsg}</em> : null}
                      </div>
                      <label className="account-field-full">
                        Rua / logradouro
                        <input
                          value={restStreet}
                          onChange={(e) => setRestStreet(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Número
                        <input
                          value={restNumber}
                          onChange={(e) => setRestNumber(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Bairro
                        <input
                          value={restNeighborhood}
                          onChange={(e) => setRestNeighborhood(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Cidade
                        <input
                          value={restCity}
                          onChange={(e) => setRestCity(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        UF
                        <input
                          value={restUf}
                          onChange={(e) => setRestUf(e.target.value.toUpperCase().slice(0, 2))}
                          maxLength={2}
                          required
                        />
                      </label>
                      <label className="account-field-full">
                        Site (opcional)
                        <input
                          value={restWebsite}
                          onChange={(e) => setRestWebsite(e.target.value)}
                          placeholder="https://"
                        />
                      </label>
                    </div>
                  </>
                )}

                {accountError && <p className="account-msg error">{accountError}</p>}
                {accountMsg && <p className="account-msg ok">{accountMsg}</p>}
                <button type="submit" className="btn-search" disabled={accountSaving}>
                  {accountSaving ? "Salvando…" : "Salvar alterações"}
                </button>
              </form>
            )}

            {accountTab === "senha" && (
              <form className="account-card" onSubmit={onChangePassword} role="tabpanel">
                <div className="account-card-head">
                  <h3>{user?.has_password ? "Mudar senha" : "Definir senha"}</h3>
                  <p>
                    {user?.has_password
                      ? "Troque a senha da sua conta com segurança."
                      : "Crie uma senha para entrar também com e-mail."}
                  </p>
                </div>
                {!user?.has_password && (
                  <p className="account-hint">
                    Sua conta ainda não tem senha{user?.google_id ? " (login Google)" : ""}.
                  </p>
                )}
                <div className="account-fields account-fields-password">
                  {user?.has_password && (
                    <label className="account-field-full">
                      Senha atual
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                    </label>
                  )}
                  <label>
                    Nova senha
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </label>
                  <label>
                    Confirmar nova senha
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </label>
                </div>
                {passwordError && <p className="account-msg error">{passwordError}</p>}
                {passwordMsg && <p className="account-msg ok">{passwordMsg}</p>}
                <button type="submit" className="btn-search" disabled={passwordSaving}>
                  {passwordSaving ? "Salvando…" : user?.has_password ? "Atualizar senha" : "Criar senha"}
                </button>
              </form>
            )}

            {accountTab === "sobre" && (
              <div className="account-card" role="tabpanel">
                <div className="account-card-head">
                  <h3>Sobre o FilaZero</h3>
                  <p>Informações do aplicativo e como ele funciona.</p>
                </div>
                <ul className="about-list">
                  <li>
                    <strong>Versão</strong>
                    <span>0.1.0</span>
                  </li>
                  <li>
                    <strong>O que faz</strong>
                    <span>
                      Ajuda a escolher onde almoçar com base em distância, espera estimada e tipo
                      de comida perto de você.
                    </span>
                  </li>
                  <li>
                    <strong>Mapa e locais</strong>
                    <span>OpenStreetMap (Overpass / Nominatim) — dados abertos e gratuitos.</span>
                  </li>
                  <li>
                    <strong>Assistente</strong>
                    <span>
                      Sugestões por chat (Ollama local quando habilitado, ou respostas mock).
                    </span>
                  </li>
                  <li>
                    <strong>Seus dados</strong>
                    <span>Favoritos, histórico e perfil ficam na sua conta FilaZero.</span>
                  </li>
                </ul>
                <p className="account-hint">
                  Projeto educacional — estimativas de espera e preço podem não refletir a fila
                  real até haver dados de parceiros.
                </p>
                <Link to="/" className="about-link">
                  Voltar à página inicial
                </Link>
              </div>
            )}

            {accountTab === "excluir" && (
              <form className="account-card account-card-danger" onSubmit={onDeleteAccount} role="tabpanel">
                <div className="account-card-head">
                  <h3>Excluir conta</h3>
                  <p>Essa ação apaga sua conta e não pode ser desfeita.</p>
                </div>
                <p className="account-hint danger">
                  Serão removidos perfil, favoritos e histórico. Preencha os campos abaixo para continuar.
                </p>
                <div className="account-fields">
                  <label>
                    1. Digite a palavra EXCLUIR neste campo
                    <input
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                      placeholder="EXCLUIR"
                      autoComplete="off"
                      required
                    />
                  </label>
                  {user?.has_password && (
                    <label>
                      2. Digite sua senha neste campo
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="Sua senha atual"
                        autoComplete="current-password"
                        required
                      />
                    </label>
                  )}
                </div>
                {deleteError && <p className="account-msg error">{deleteError}</p>}
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={
                    deleteSaving ||
                    deleteConfirm.trim().toUpperCase() !== "EXCLUIR" ||
                    (user?.has_password && !deletePassword)
                  }
                >
                  {deleteSaving ? "Excluindo…" : "Excluir minha conta"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
