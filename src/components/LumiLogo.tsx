import React from 'react';

interface LumiLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LumiLogo: React.FC<LumiLogoProps> = ({ size = 'md', className = '' }) => {
  const heightClass =
    size === 'lg'
      ? 'h-24 sm:h-28'
      : size === 'sm'
        ? 'h-9 sm:h-10'
        : 'h-12 sm:h-14';

  return (
    <img
      src="/assets/Lumi_logo_original_limpio_transparente.png"
      alt="Lumi"
      draggable={false}
      className={`inline-block w-auto select-none bg-transparent object-contain ${heightClass} ${className}`}
    />
  );
};
