import React from 'react';

/**
 * Componente Logo para la Pizzería El Alemán.
 * Muestra la imagen oficial public/logo.jpeg recortada en círculo (rounded-full, object-cover)
 * evitando bordes negros cuadrados sobre los fondos del sistema.
 */
export default function Logo({ size = 40, className = '', alt = 'El Alemán Pizzería' }) {
  const numericSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <img
      src="/logo.jpeg"
      alt={alt}
      className={`rounded-full object-cover shrink-0 select-none ${className}`}
      style={{
        width: numericSize,
        height: numericSize,
        borderRadius: '9999px',
        objectFit: 'cover',
      }}
    />
  );
}
