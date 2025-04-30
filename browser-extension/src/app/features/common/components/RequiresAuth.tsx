import React, { useEffect } from 'react';
import useSettings from '../../settings/useSettings';
import { PiCircleNotchBold } from 'react-icons/pi';
import useAuth from '../hooks/useAuth';
import { Amplify } from 'aws-amplify';
import { I18n } from 'aws-amplify/utils';
import { Authenticator, translations } from '@aws-amplify/ui-react';
import Browser from 'webextension-polyfill';
import Button from './Button';
import { IconWrapper } from '../../../components/IconWrapper';

type Props = {
  children: React.ReactNode;
};

const RequiresAuth: React.FC<Props> = (props) => {
  const { settings } = useSettings();
  const { loading, authenticate, hasAuthenticated } = useAuth();
  useEffect(() => {
    if (settings) {
      if (settings.enabledSamlAuth) {
        // SAML configuration
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
      } else {
        // UserPool configuration
        Amplify.configure({
          Auth: {
            Cognito: {
              userPoolId: settings.userPoolId,
              userPoolClientId: settings.userPoolClientId,
              identityPoolId: settings.identityPoolId,
            },
          },
        });
        I18n.putVocabularies(translations);
        I18n.setLanguage('ja');
      }
      // If the authentication configuration is set, authenticate
      authenticate();
    }
  }, [authenticate, settings]);

  const signIn = () => {
    const url = Browser.runtime.getURL('/index.html');
    Browser.tabs.create({ url });
  };

  return (
    <>
      {!settings || loading ? (
        <div className="flex flex-col items-center">
          <div className="italic">Loading...</div>
          <IconWrapper icon={PiCircleNotchBold} className="text-6xl animate-spin" />
        </div>
      ) : (
        <>
          {hasAuthenticated ? (
            <>{props.children}</>
          ) : settings.enabledSamlAuth ? (
            <div className="flex justify-center mt-3">
              <Button onClick={() => signIn()}>ログイン画面へ</Button>
            </div>
          ) : (
            <Authenticator hideSignUp={!settings.enabledSelfSignUp}>{props.children}</Authenticator>
          )}
        </>
      )}
    </>
  );
};

export default RequiresAuth;
