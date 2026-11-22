import React from 'react';
import Help from '../Help';

type Props = {
  name: string;
  value: string | React.ReactNode;
  helpMessage?: string;
  top?: boolean;
};

const SettingItem: React.FC<Props> = (props) => {
  return (
    <div
      className={`border-aws-squid-ink grid grid-cols-12 border-solid px-1 py-2 hover:bg-gray-200 ${props.top ? 'border-y' : 'border-b'}`}>
      <div className="col-span-4 flex items-center justify-start">
        {props.name}
        {props.helpMessage && <Help message={props.helpMessage} />}
      </div>
      <div className="col-span-8 flex items-center justify-end">
        {props.value}
      </div>
    </div>
  );
};

export default SettingItem;
