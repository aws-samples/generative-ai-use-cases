import React from 'react';
import { BaseProps } from '../@types/common';
import RowItem from './RowItem';
import Help from './Help';

type Props = BaseProps & {
  label?: string;
  help?: string;
  sub?: string;
  children: React.ReactNode;
};

const Card: React.FC<Props> = (props) => {
  return (
    <div
      className={`${
        props.className ?? ''
      } border-aws-font-color/20 rounded-lg border p-5 shadow`}>
      {props.label && (
        <RowItem className="flex items-center">
          <span className="font-semibold">{props.label}</span>
          {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
          {props.sub && <span className="ml-2 text-sm">({props.sub})</span>}
          {props.help && <Help className="ml-1" message={props.help} />}
        </RowItem>
      )}
      {props.children}
    </div>
  );
};

export default Card;
