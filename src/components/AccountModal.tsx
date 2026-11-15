import React, { useState } from 'react';
import { X, LogOut, Check } from 'lucide-react';
import type { AccessibilityMode, LumiUser } from '../types/lumi';
import { IDENTITY_OPTIONS, MODE_METADATA, validateAccountInput } from '../utils/lumiLogic';
import {
  loginAccount,
  logoutAccount,
  registerAccount,
  updateUserProfile,
} from '../utils/api';

interface AccountModalProps {
  open: boolean;
  user: LumiUser | null;
  currentMode: AccessibilityMode;
  currentName: string;
  currentIdentity: string;
  currentAltControls: boolean;
  onClose: () => void;
  onAuthSuccess: (user: LumiUser) => void;
  onGuestProfileUpdate: (patch: {
    mode: AccessibilityMode;
    name: string;
    identity: string;
    alternativeControls: boolean;
  }) => void;
  onLoggedOut: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  open,
  user,
  currentMode,
  currentName,
  currentIdentity,
  currentAltControls,
  onClose,
  onAuthSuccess,
  onGuestProfileUpdate,
  onLoggedOut,
}) => {
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [name, setName] = useState(user?.name ?? currentName);
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<AccessibilityMode>(user?.mode ?? currentMode);
  const [identity, setIdentity] = useState(user?.identity ?? currentIdentity);
  const [altControls, setAltControls] = useState(
    user?.alternativeControls ?? currentAltControls
  );
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const check = validateAccountInput({
      name: name.trim(),
      email,
      password,
      isRegister: tab === 'register',
    });
    if (!check.valid) {
      setError(check.error || 'Datos inválidos.');
      return;
    }
    setBusy(true);
    try {
      const res =
        tab === 'register'
          ? await registerAccount({
              name: name.trim(),
              email,
              password,
              mode,
              alternativeControls: altControls,
              identity,
            })
          : await loginAccount({ email, password });
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (user) {
      setBusy(true);
      try {
        const updated = await updateUserProfile({
          name: name.trim() || user.name,
          mode,
          alternativeControls: altControls,
          identity,
        });
        onAuthSuccess(updated);
        setSuccessMsg('Preferencias guardadas en tu cuenta Lumi.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
      } finally {
        setBusy(false);
      }
    } else {
      onGuestProfileUpdate({
        name: name.trim(),
        mode,
        identity,
        alternativeControls: altControls,
      });
      setSuccessMsg('Modo actualizado para esta sesión.');
    }
  };

  const handleLogout = async () => {
    await logoutAccount();
    onLoggedOut();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E9E5D9] bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#E9E5D9] pb-4">
          <h2 id="account-modal-title" className="text-xl font-bold text-[#202020]">
            {user ? `Cuenta Lumi · ${user.name}` : 'Tu cuenta en Lumi'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de cuenta"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#E9E5D9] text-[#202020] hover:bg-[#F7F5EE]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {user ? (
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
            <div className="rounded-xl bg-[#FFF9E9] p-3 text-sm text-[#202020]">
              Sesión activa como <strong>{user.email}</strong>
            </div>

            <div>
              <label htmlFor="profile-name" className="block text-sm font-semibold text-[#202020]">
                Nombre visible
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 min-h-[46px] w-full rounded-xl border border-[#D8D3C5] px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="profile-mode" className="block text-sm font-semibold text-[#202020]">
                Modo de accesibilidad
              </label>
              <select
                id="profile-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as AccessibilityMode)}
                className="mt-1 min-h-[46px] w-full rounded-xl border border-[#D8D3C5] bg-white px-4 py-2.5 text-sm"
              >
                {(Object.keys(MODE_METADATA) as AccessibilityMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_METADATA[m].label} — {MODE_METADATA[m].summary}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="profile-identity" className="block text-sm font-semibold text-[#202020]">
                Identidad (opcional)
              </label>
              <select
                id="profile-identity"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                className="mt-1 min-h-[46px] w-full rounded-xl border border-[#D8D3C5] bg-white px-4 py-2.5 text-sm"
              >
                <option value="">Sin especificar</option>
                {IDENTITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-[#E9E5D9] p-3 text-sm">
              <input
                type="checkbox"
                checked={altControls}
                onChange={(e) => setAltControls(e.target.checked)}
                className="h-4 w-4 accent-[#C6A73E]"
              />
              <span>Combinar con controles adicionales y apoyos visuales</span>
            </label>

            {error && (
              <div role="alert" className="rounded-xl bg-[#FDF1F1] p-3 text-sm text-[#7D2828]">
                {error}
              </div>
            )}
            {successMsg && (
              <div role="status" className="flex items-center gap-2 rounded-xl bg-[#EBF6ED] p-3 text-sm text-[#1E5629]">
                <Check className="h-4 w-4" aria-hidden="true" />
                {successMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#F6E1E1] px-4 py-2 text-sm font-semibold text-[#793C3C]"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar sesión
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] rounded-xl bg-[#F5DF91] px-5 py-2 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
              >
                {busy ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="flex gap-2 rounded-xl bg-[#F7F5EE] p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
                className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                  tab === 'register'
                    ? 'bg-white text-[#202020] shadow-xs'
                    : 'text-[#555555]'
                }`}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
                className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                  tab === 'login'
                    ? 'bg-white text-[#202020] shadow-xs'
                    : 'text-[#555555]'
                }`}
              >
                Iniciar sesión
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-3" noValidate>
              {tab === 'register' && (
                <div>
                  <label htmlFor="modal-name" className="block text-sm font-semibold text-[#202020]">
                    Nombre
                  </label>
                  <input
                    id="modal-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="mt-1 min-h-[46px] w-full rounded-xl border border-[#D8D3C5] px-4 py-2.5 text-sm"
                  />
                </div>
              )}

              <div>
                <label htmlFor="modal-email" className="block text-sm font-semibold text-[#202020]">
                  Correo electrónico
                </label>
                <input
                  id="modal-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="mt-1 min-h-[46px] w-full rounded-xl border border-[#D8D3C5] px-4 py-2.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="modal-password" className="block text-sm font-semibold text-[#202020]">
                  Contraseña
                </label>
                <input
                  id="modal-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="mt-1 min-h-[46px] w-full rounded-xl border border-[#D8D3C5] px-4 py-2.5 text-sm"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl bg-[#FDF1F1] p-3 text-sm text-[#7D2828]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="min-h-[48px] w-full rounded-xl bg-[#F5DF91] px-5 py-3 text-sm font-bold text-[#202020] hover:bg-[#EDD37A]"
              >
                {busy
                  ? 'Conectando...'
                  : tab === 'register'
                    ? 'Crear mi cuenta Lumi'
                    : 'Iniciar sesión'}
              </button>
            </form>

            {/* Cambio rápido de modo en sesión de prueba */}
            <form onSubmit={handleSaveProfile} className="space-y-3 border-t border-[#E9E5D9] pt-4">
              <p className="text-xs font-semibold text-[#555555]">
                Ajustar modo en sesión actual
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(MODE_METADATA) as AccessibilityMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold ${
                      mode === m
                        ? 'border-[#D9BF68] bg-[#FFF9E9] text-[#202020]'
                        : 'border-[#E9E5D9] bg-white text-[#555555]'
                    }`}
                  >
                    {MODE_METADATA[m].label}
                  </button>
                ))}
              </div>
              {successMsg && (
                <div role="status" className="rounded-xl bg-[#EBF6ED] p-2.5 text-xs text-[#1E5629]">
                  {successMsg}
                </div>
              )}
              <button
                type="submit"
                className="min-h-[44px] w-full rounded-xl bg-[#F1EFEA] px-4 py-2 text-sm font-semibold text-[#202020]"
              >
                Aplicar modo sin cuenta
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
