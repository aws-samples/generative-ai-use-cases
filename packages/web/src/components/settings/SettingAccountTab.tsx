import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useSWRConfig } from 'swr';
import Button from '../Button';
import SettingItem from './SettingItem';
import DialogConfirmDeleteAllChats from '../DialogConfirmDeleteAllChats';
import useChatList from '../../hooks/useChatList';

const SettingAccountTab: React.FC = () => {
  const { t } = useTranslation();
  const { cache } = useSWRConfig();
  const { signOut } = useAuthenticator();
  const { deleteAllChats } = useChatList();
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);

  const onClickSignout = useCallback(() => {
    // Delete all SWR cache
    for (const key of cache.keys()) {
      cache.delete(key);
    }
    signOut();
  }, [cache, signOut]);

  const onClickDeleteAllChats = useCallback(async () => {
    try {
      await deleteAllChats();
      setIsDeleteAllDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete all chats:', error);
    }
  }, [deleteAllChats]);

  return (
    <div className="text-sm">
      <SettingItem
        name={t('setting.items.login_status')}
        value={<Button onClick={onClickSignout}>{t('setting.signout')}</Button>}
        top={true}
      />

      <SettingItem
        name={t('setting.items.delete_all_chats')}
        value={
          <Button
            onClick={() => setIsDeleteAllDialogOpen(true)}
            className="bg-red-500 text-white">
            {t('setting.items.delete_all_chats_button')}
          </Button>
        }
      />

      <DialogConfirmDeleteAllChats
        isOpen={isDeleteAllDialogOpen}
        onDelete={onClickDeleteAllChats}
        onClose={() => setIsDeleteAllDialogOpen(false)}
      />
    </div>
  );
};

export default SettingAccountTab;
