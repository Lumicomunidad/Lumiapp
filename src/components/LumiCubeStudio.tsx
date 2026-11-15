import React, { useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Volume2,
  Accessibility,
  CheckCircle2,
} from 'lucide-react';
import type { CubeButtonSpec, CubeFaceSpec, LumiUser } from '../types/lumi';
import { CUBE_BUTTONS, CUBE_FACES } from '../utils/lumiLogic';
import { speakWithBestVoice } from '../utils/speech';
import { updateUserProfile } from '../utils/api';

interface LumiCubeStudioProps {
  user: LumiUser | null;
  onUserUpdated: (user: LumiUser) => void;
  onCubeButtonPress: (btn: CubeButtonSpec) => void;
  onBack: () => void;
}

export const LumiCubeStudio: React.FC<LumiCubeStudioProps> = ({
  user,
  onUserUpdated,
  onCubeButtonPress,
  onBack,
}) => {
  const [selectedFace, setSelectedFace] = useState<CubeFaceSpec>(CUBE_FACES[0]);
  const [guestPaired, setGuestPaired] = useState(false);
  const [lastPressed, setLastPressed] = useState<CubeButtonSpec | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);

  const isPaired = user ? user.cubePaired : guestPaired;

  const handleTogglePair = async () => {
    const nextValue = !isPaired;
    if (user) {
      setPairingBusy(true);
      try {
        const updated = await updateUserProfile({ cubePaired: nextValue });
        onUserUpdated(updated);
      } finally {
        setPairingBusy(false);
      }
    } else {
      setGuestPaired(nextValue);
    }
    speakWithBestVoice(
      nextValue
        ? 'LumiCube simulado vinculado. Ya puedes probar los nueve botones táctiles.'
        : 'LumiCube simulado desvinculado.'
    );
  };

  const handlePressButton = (btn: CubeButtonSpec) => {
    setLastPressed(btn);
    onCubeButtonPress(btn);
  };

  return (
    <section aria-labelledby="lumicube-heading" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E9E5D9] bg-white px-3.5 py-2 text-sm font-semibold text-[#202020] hover:bg-[#F7F5EE]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al menú
          </button>
          <h1 id="lumicube-heading" className="text-2xl font-bold text-[#202020] sm:text-3xl">
            Teléfono Cubo con Lumi (LumiCube)
          </h1>
          <p className="mt-1 text-sm text-[#555555]">
            Explora las 6 caras del dispositivo físico a futuro y prueba sus 9 botones táctiles directamente en la app.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTogglePair}
          disabled={pairingBusy}
          className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold ${
            isPaired
              ? 'border border-[#D9BF68] bg-[#FFF9E9] text-[#202020]'
              : 'bg-[#F5DF91] text-[#202020] hover:bg-[#EDD37A]'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {isPaired ? 'LumiCube vinculado (Simulación activa)' : 'Vincular LumiCube de prueba'}
        </button>
      </div>

      {/* Imagen de arquitectura + Explorador de las 6 caras */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 rounded-2xl border border-[#E9E5D9] bg-white p-5 lg:col-span-6">
          <h2 className="text-base font-bold text-[#202020]">
            Plano físico del Teléfono Cubo con Lumi
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#E9E5D9] bg-[#FDFBF6]">
            <img
              src="/assets/aistudio/image_d6ac20fb.png"
              alt="Diagrama completo de las seis caras y nueve botones del Teléfono Cubo con Lumi"
              className="h-auto w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl bg-[#FDFBF6] p-3 text-xs text-[#333333]">
              <strong className="block font-semibold text-[#202020]">Relieve Braille integrado</strong>
              Puntos táctiles en Cara Superior (Grabar / Detener) y Cara Trasera (Reproducir / Pausar).
            </div>
            <div className="rounded-xl bg-[#FDFBF6] p-3 text-xs text-[#333333]">
              <strong className="block font-semibold text-[#202020]">Navegación sin pantalla</strong>
              Botones diferenciados por cara para operar con una sola mano y respuesta por voz Lumi.
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-6">
          <div className="rounded-2xl border border-[#E9E5D9] bg-white p-5">
            <h2 className="text-base font-bold text-[#202020]">
              Explora cada cara del cubo
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CUBE_FACES.map((face) => {
                const selected = selectedFace.id === face.id;
                return (
                  <button
                    key={face.id}
                    type="button"
                    onClick={() => setSelectedFace(face)}
                    aria-pressed={selected}
                    className={`min-h-[48px] rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
                      selected
                        ? 'border-[#D9BF68] bg-[#FFF9E9] text-[#202020]'
                        : 'border-[#E9E5D9] bg-white text-[#555555] hover:bg-[#FDFBF6]'
                    }`}
                  >
                    {face.name}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-[#E9E5D9] bg-[#FFF9E9] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-[#202020]">{selectedFace.name}</h3>
                <button
                  type="button"
                  onClick={() =>
                    speakWithBestVoice(
                      `${selectedFace.name}. ${selectedFace.primaryFunction}. ${selectedFace.description}`
                    )
                  }
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D9BF68] bg-white px-3 py-1 text-xs font-semibold text-[#202020]"
                >
                  <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Escuchar cara
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold text-[#7A611B]">
                {selectedFace.primaryFunction}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#202020]">
                {selectedFace.description}
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-[#333333]">
                {selectedFace.controls.map((ctrl) => (
                  <li key={ctrl} className="rounded-lg bg-white/80 px-3 py-2 font-medium">
                    {ctrl}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 4 Pilares del producto */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#E9E5D9] bg-white p-4">
              <CreditCard className="h-5 w-5 text-[#7A611B]" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-bold text-[#202020]">
                Pagos por voz y tarjeta NFC
              </h3>
              <p className="mt-1 text-xs text-[#555555]">
                Confirmación auditiva segura con botón físico Confirmar / Cancelar.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E9E5D9] bg-white p-4">
              <ShieldCheck className="h-5 w-5 text-[#7A611B]" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-bold text-[#202020]">
                Seguridad y privacidad
              </h3>
              <p className="mt-1 text-xs text-[#555555]">
                Control total de micrófono y datos protegidos en tu cuenta Lumi.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E9E5D9] bg-white p-4">
              <Volume2 className="h-5 w-5 text-[#7A611B]" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-bold text-[#202020]">
                Asistente de voz Lumi
              </h3>
              <p className="mt-1 text-xs text-[#555555]">
                Comandos simples en español para leer, responder o abrir apps.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E9E5D9] bg-white p-4">
              <Accessibility className="h-5 w-5 text-[#7A611B]" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-bold text-[#202020]">
                Más independencia, más inclusión
              </h3>
              <p className="mt-1 text-xs text-[#555555]">
                Pensado para personas ciegas, mudas, sordas y usuarios generales.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controlador táctil de los 9 botones */}
      <div className="rounded-2xl border border-[#E9E5D9] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#202020]">
              Simulador de los 9 botones del LumiCube
            </h2>
            <p className="text-sm text-[#555555]">
              Pulsa cualquier botón para probar su acción real dentro de la aplicación web.
            </p>
          </div>
          {lastPressed && (
            <div className="rounded-xl bg-[#FFF9E9] px-3.5 py-2 text-xs font-semibold text-[#202020]">
              Botón {lastPressed.number}: {lastPressed.label} — {lastPressed.description}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:grid-cols-3">
          {CUBE_BUTTONS.map((btn) => (
            <button
              key={btn.number}
              type="button"
              onClick={() => handlePressButton(btn)}
              className="flex min-h-[60px] items-center gap-3 rounded-xl border border-[#E9E5D9] bg-[#FDFBF6] p-3 text-left hover:border-[#D9BF68] hover:bg-[#FFF9E9]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#202020] text-sm font-bold text-[#F5DF91] tabular-nums">
                {btn.number}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-[#202020]">
                  {btn.shortSymbol} {btn.label}
                </div>
                <div className="truncate text-xs text-[#555555]">{btn.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
