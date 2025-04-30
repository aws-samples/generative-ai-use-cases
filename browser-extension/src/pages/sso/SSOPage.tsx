import React, { useEffect } from 'react';
import '@aws-amplify/ui-react/styles.css';
import useSettings from '../../app/features/settings/useSettings';
import { Amplify } from 'aws-amplify';
import { signInWithRedirect } from 'aws-amplify/auth';
import { PiCircleNotchBold, PiWarningFill } from 'react-icons/pi';
import Button from '../../app/features/common/components/Button';
import useAuth from '../../app/features/common/hooks/useAuth';
import { IconWrapper } from '../../app/components/IconWrapper';

const SSOPage: React.FC = () => {
  const { authenticate, loading, hasAuthenticated } = useAuth();
  const { settings } = useSettings();

  useEffect(() => {
    if (settings) {
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId: import.meta.env.VITE_APP_USER_POOL_ID,
            userPoolClientId: import.meta.env.VITE_APP_USER_POOL_CLIENT_ID,
            identityPoolId: import.meta.env.VITE_APP_IDENTITY_POOL_ID,
            loginWith: {
              oauth: {
                domain: settings.cognitoDomain ?? '',
                scopes: ['openid', 'email', 'profile'],
                redirectSignIn: [`${window.location.origin}/index.html`],
                redirectSignOut: [window.location.origin],
                responseType: 'code',
              },
            },
          },
        },
      });
      authenticate();
    }
  }, [authenticate, settings]);

  const signIn = () => {
    signInWithRedirect({
      provider: {
        custom: settings?.federatedIdentityProviderName ?? '',
      },
    });
  };

  return (
    <div className="text-white flex-col flex items-center gap-3 text-base">
      <div className="flex flex-col items-center text-2xl font-bold mt-3">
        <div>Generative AI Use Cases JP 拡張機能</div>
      </div>

      {settings?.enabledSamlAuth && (
        <>
          {loading ? (
            <div>
              <div className="italic">Loading...</div>
              <IconWrapper icon={PiCircleNotchBold} className="text-6xl animate-spin" />
            </div>
          ) : !hasAuthenticated ? (
            <div>
              <Button onClick={() => signIn()}>SSO ログイン</Button>
            </div>
          ) : (
            <>
              <div className="border rounded p-2 flex items-center gap-2">
                <div>
                  <div>ログイン済みです。</div>
                  <div>この画面を閉じて、拡張機能をご利用ください。</div>
                </div>
              </div>
              <Button
                onClick={() => {
                  window.close();
                }}
              >
                画面を閉じる
              </Button>
            </>
          )}
        </>
      )}
      {!settings?.enabledSamlAuth && (
        <>
          <div className="border rounded p-2 flex items-center gap-2">
            <IconWrapper icon={PiWarningFill} />
            SAML認証が有効化されていないため、SSOは利用できません。
          </div>
          <Button
            onClick={() => {
              window.close();
            }}
          >
            画面を閉じる
          </Button>
        </>
      )}
    </div>
  );
};

export default SSOPage;
