import React from 'react';

interface LumiOrbProps {
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  label?: string;
}

/**
 * Núcleo visual futurista de Lumi con anillos orbitales solares y ondas de voz activas.
 */
export const LumiOrb: React.FC<LumiOrbProps> = ({
  size = 'md',
  active = false,
  label = 'Núcleo solar interactivo de Lumi',
}) => {
  const dims =
    size === 'sm'
      ? 'h-12 w-12'
      : size === 'lg'
        ? 'h-24 w-24'
        : 'h-16 w-16';

  const coreDims =
    size === 'sm'
      ? 'h-6 w-6'
      : size === 'lg'
        ? 'h-12 w-12'
        : 'h-8 w-8';

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${dims}`}
      role="img"
      aria-label={label}
    >
      {/* Halo exterior */}
      <span
        className="absolute inset-0 rounded-full bg-radial from-[#F5DF91]/45 via-[#FFF9E9]/20 to-transparent blur-sm"
        aria-hidden="true"
      />

      {/* Anillo orbital externo */}
      <span
        className="lumi-orbit-slow absolute inset-0 rounded-full border border-dashed border-[#D9BF68]/80"
        aria-hidden="true"
      >
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#D9BF68]" />
      </span>

      {/* Anillo orbital interno */}
      <span
        className="lumi-orbit-reverse absolute inset-2 rounded-full border border-[#F5DF91]"
        aria-hidden="true"
      >
        <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#202020]" />
      </span>

      {/* Núcleo central solar */}
      <span
        className={`lumi-core-breathe relative flex items-center justify-center rounded-full bg-gradient-to-br from-[#FFF9E9] via-[#F5DF91] to-[#D9BF68] ${coreDims}`}
      >
        {active ? (
          <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
            <span className="lumi-wave-1 h-3 w-0.5 rounded-full bg-[#202020]" />
            <span className="lumi-wave-2 h-4 w-0.5 rounded-full bg-[#202020]" />
            <span className="lumi-wave-3 h-3.5 w-0.5 rounded-full bg-[#202020]" />
            <span className="lumi-wave-4 h-2.5 w-0.5 rounded-full bg-[#202020]" />
          </span>
        ) : (
          <span className="h-2 w-2 rounded-full bg-[#202020]/80" aria-hidden="true" />
        )}
      </span>
    </div>
  );
};
