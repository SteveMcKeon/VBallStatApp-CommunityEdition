import React, { useState } from 'react';
const FloatingLabelInput = ({ label, type = 'text', id, name, isError, value, onChange, className = '' }) => {
  const [isFocused, setIsFocused] = useState(false);
  const shouldFloat = isFocused || value.length > 0;
  return (
    <div className="relative w-full mt-6">
      <input
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`w-full px-4 pt-6 pb-2 text-sm text-black border rounded-full focus:outline-none transition-all duration-300 ease-in-out 
          ${isError ? 'border-red-500 focus:border-red-500' : 'border-gray-400 focus:border-blue-500'}
          ${className}
        `}
      />
      <label
        htmlFor={id}
        className={`absolute left-4 px-1 transition-all pointer-events-none duration-300 ease-in-out
          ${shouldFloat ? 'top-1 text-xs' : 'top-3.5 text-base'} ${isError ? 'text-red-500' : shouldFloat ? 'text-blue-500' : 'text-gray-400'
          }`}
      >
        {label}
      </label>
    </div>
  );
};
export default FloatingLabelInput;
