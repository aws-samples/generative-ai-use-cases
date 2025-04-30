import React, { useMemo, useState } from 'react';
import RowItem, { RowItemProps } from './RowItem';
import { PiCaretRightFill } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

type Props = RowItemProps & {
  label: string;
  defaultOpened?: boolean;
  optional?: boolean;
  children: React.ReactNode;
  // If you want to control the toggle state from the parent component
  overrideExpanded?: boolean;
  setOverrideExpanded?: (overrideExpanded: boolean) => void;
};

const ExpandableField: React.FC<Props> = (props) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(props.defaultOpened ?? false);

  // To correspond to the override of the toggle state, take the or of expanded and overrideExpanded
  const expandState = useMemo(
    () => expanded || props.overrideExpanded,
    [expanded, props.overrideExpanded]
  );

  return (
    <RowItem notItem={props.notItem} className={props.className}>
      <div
        className="mb-1 flex cursor-pointer items-center text-sm font-semibold"
        onClick={() => {
          setExpanded(!expandState);
          if (props.setOverrideExpanded) {
            props.setOverrideExpanded(!expandState);
          }
        }}>
        <PiCaretRightFill
          className={`mr-1 ${expandState && 'rotate-90'} transition`}
        />
        {props.label}
        {props.optional && (
          <>
            {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
            <span className="mx-2">-</span>
            <span className="font-light italic">{t('common.optional')}</span>
          </>
        )}
      </div>

      {expandState && <>{props.children}</>}
    </RowItem>
  );
};

export default ExpandableField;
