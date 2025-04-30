import React from 'react';
import { BaseProps } from '../@types/common';

type Props = BaseProps & {
  checked: boolean;
  onSwitch: (newValue: boolean) => void;
  label: string;
};

const Switch: React.FC<Props> = (props) => {
  return (
    <div className={`${props.className ?? ''} flex`}>
      <label className="relative inline-flex cursor-pointer items-center hover:underline">
        <input
          type="checkbox"
          value=""
          className="peer sr-only"
          checked={props.checked}
          onChange={() => {
            props.onSwitch(!props.checked);
          }}
        />
        <div className="peer-checked:bg-aws-smile peer relative h-6 w-11 min-w-11 rounded-full bg-gray-200 transition-colors">
          <span
            className={`absolute inset-y-[2px] left-[2px] size-5 rounded-full border border-gray-300 bg-white transition-all ${props.checked ? 'translate-x-5 border-white' : ''}`}></span>
        </div>
        <span className="ml-1 break-words text-xs font-medium">
          {props.label}
        </span>
      </label>
    </div>
  );
};

export default Switch;
