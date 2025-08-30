import React from 'react';
import Select from 'react-select';
import { FaCircle } from 'react-icons/fa';
import TooltipPortal from '../utils/tooltipPortal';
export const selectStyles = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  control: (base, state) => ({
    ...base,
    border: '1px solid black',
    width: 'auto',
    maxWidth: '100%',
    height: '32px',
    whiteSpace: 'nowrap',
    overflow: 'visible',
    cursor: state?.isDisabled ? 'not-allowed' : 'pointer',
  }),
  dropdownIndicator: (base) => ({ ...base, cursor: 'pointer' }),
  clearIndicator: (base) => ({ ...base, cursor: 'pointer' }),
  indicatorSeparator: (base) => ({ ...base, cursor: 'pointer' }),
  option: (base) => ({ ...base, cursor: 'pointer' }),
  menu: (base) => ({ ...base, cursor: 'pointer' }),
  menuList: (base) => ({ ...base, cursor: 'pointer' }),
  placeholder: (base) => ({
    ...base,
    fontStyle: 'italic',
    color: '#6b7280',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  singleValue: (base) => ({
    ...base,
    overflow: 'visible',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  }),
  valueContainer: (base) => ({
  ...base,
  display: 'flex',
  overflow: 'visible',
  flexWrap: 'nowrap',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  cursor: 'pointer',
}),
};
// Tooltip-aware icon
const TooltipIcon = ({ color, tooltip }) => {
  const [hovered, setHovered] = React.useState(false);
  const iconRef = React.useRef(null);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  React.useEffect(() => {
    if (hovered && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top - 36,
        left: rect.left + rect.width / 2,
      });
    }
  }, [hovered]);
  return (
    <>
      <div
        ref={iconRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center justify-center ml-2 min-w-[1rem]"
      >
        <FaCircle size={11} color={color} />
      </div>
      {hovered && tooltip && (
        <TooltipPortal>
          <div
            className="fixed z-[9999] bg-black text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap"
            style={{
              top: coords.top,
              left: coords.left,
              transform: 'translateX(-50%)',
            }}
          >
            {tooltip}
          </div>
        </TooltipPortal>
      )}
    </>
  );
};
// Value renderer
const CustomSingleValue = ({ data, selectProps }) => (
  <div className="flex w-full items-center justify-between text-sm">
    <span className="truncate ">{data.label}</span>
    {selectProps.showStatus && data.color && (
      selectProps.showTooltip && data.tooltip ? (
        <TooltipIcon color={data.color} tooltip={data.tooltip} />
      ) : (
        <div className="flex items-center justify-center ml-2 min-w-[1rem]">
          <FaCircle size={11} color={data.color} />
        </div>
      )
    )}
  </div>
);
// Option renderer
const CustomOption = ({ data, innerRef, innerProps, selectProps }) => (
  <div
    ref={innerRef}
    {...innerProps}
    className="flex items-center justify-between gap-2 px-2 py-1 hover:bg-gray-100 relative cursor-pointer"
  >
    <span className="truncate">{data.label}</span>
    {selectProps.showStatus && data.color && (
      selectProps.showTooltip && data.tooltip ? (
        <TooltipIcon color={data.color} tooltip={data.tooltip} />
      ) : (
        <div className="flex items-center justify-center">
          <FaCircle size={11} color={data.color} />
        </div>
      )
    )}
  </div>
);
// Main component
const StyledSelect = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  showStatus = false,
  showTooltip = false,
}) => {
  return (
    <Select
      menuPortalTarget={document.body}
      menuPosition="absolute"
      options={options}
      value={options.find((opt) => opt.value === value)}
      onChange={onChange}
      placeholder={placeholder}
      isSearchable={false}
      styles={selectStyles}
      components={{
        SingleValue: CustomSingleValue,
        Option: CustomOption,
      }}
      showStatus={showStatus}
      showTooltip={showTooltip}
    />
  );
};
export default StyledSelect;
