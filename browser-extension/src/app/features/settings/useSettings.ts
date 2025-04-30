import Browser from 'webextension-polyfill';
import { Settings } from '../../../@types/settings';
import { useCallback, useEffect, useState } from 'react';
import { produce } from 'immer';

const SETTINGS_KEY = 'bedrock-extension-settings';

const useSettings = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hasConfiguredSettings, setHasConfiguredSettings] = useState(false);

  const setSetting = useCallback((key: keyof Settings, value: string | boolean) => {
    setSettings((prev) =>
      produce(prev, (draft) => {
        if (!draft) {
          draft = {
            userPoolId: '',
            identityPoolId: '',
            lambdaArn: '',
            region: '',
            userPoolClientId: '',
            apiEndpoint: '',
            enabledSamlAuth: false,
            enabledSelfSignUp: false,
            cognitoDomain: '',
            federatedIdentityProviderName: '',
          };
        }
        if (key === 'enabledSamlAuth' || key === 'enabledSelfSignUp') {
          if (typeof value === 'boolean') {
            draft[key] = value;
          } else {
            throw new Error(`${key}は、boolean型で入力してください`);
          }
        } else {
          if (typeof value === 'string') {
            draft[key] = value;
          } else {
            throw new Error(`${key}は、string型で入力してください`);
          }
        }
      }),
    );
  }, []);

  useEffect(() => {
    Browser.storage.local.get(SETTINGS_KEY).then((value) => {
      const identityPoolId =
        value[SETTINGS_KEY]?.identityPoolId ?? import.meta.env.VITE_APP_IDENTITY_POOL_ID;
      const lambdaArn =
        value[SETTINGS_KEY]?.lambdaArn ?? import.meta.env.VITE_APP_PREDICT_STREAM_FUNCTION_ARN;
      const userPoolClientId =
        value[SETTINGS_KEY]?.userPoolClientId ?? import.meta.env.VITE_APP_USER_POOL_CLIENT_ID;
      const userPoolId = value[SETTINGS_KEY]?.userPoolId ?? import.meta.env.VITE_APP_USER_POOL_ID;
      const region = value[SETTINGS_KEY]?.region ?? import.meta.env.VITE_APP_REGION;
      const apiEndpoint = value[SETTINGS_KEY]?.apiEndpoint ?? import.meta.env.VITE_APP_API_ENDPOINT;
      const enabledSamlAuth =
        value[SETTINGS_KEY]?.enabledSamlAuth ??
        import.meta.env.VITE_APP_SAMLAUTH_ENABLED === 'true';
      const enabledSelfSignUp =
        value[SETTINGS_KEY]?.enabledSelfSignUp ??
        import.meta.env.VITE_APP_SELF_SIGN_UP_ENABLED === 'true';
      const cognitoDomain =
        value[SETTINGS_KEY]?.cognitoDomain ?? import.meta.env.VITE_APP_SAML_COGNITO_DOMAIN_NAME;
      const federatedIdentityProviderName =
        value[SETTINGS_KEY]?.federatedIdentityProviderName ??
        import.meta.env.VITE_APP_SAML_COGNITO_FEDERATED_IDENTITY_PROVIDER_NAME;

      setSettings({
        apiEndpoint: apiEndpoint ?? '',
        identityPoolId: identityPoolId ?? '',
        lambdaArn: lambdaArn ?? '',
        region: region ?? '',
        userPoolClientId: userPoolClientId ?? '',
        userPoolId: userPoolId ?? '',
        enabledSamlAuth: enabledSamlAuth ?? false,
        enabledSelfSignUp: enabledSelfSignUp ?? false,
        cognitoDomain: cognitoDomain ?? '',
        federatedIdentityProviderName: federatedIdentityProviderName ?? '',
      });

      // The required items differ depending on whether SAML authentication is enabled
      if (enabledSamlAuth) {
        if (!!cognitoDomain && !!federatedIdentityProviderName) {
          setHasConfiguredSettings(true);
        } else {
          setHasConfiguredSettings(false);
        }
      } else {
        if (
          !!identityPoolId &&
          !!lambdaArn &&
          !!userPoolClientId &&
          !!userPoolId &&
          !!region &&
          !!apiEndpoint
        ) {
          setHasConfiguredSettings(true);
        } else {
          setHasConfiguredSettings(false);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    hasConfiguredSettings,
    settings,
    setSetting,
    save: () => {
      Browser.storage.local
        .set({
          [SETTINGS_KEY]: settings,
        })
        .then(() => {
          if (settings) {
            setHasConfiguredSettings(
              !!settings.identityPoolId &&
                !!settings.lambdaArn &&
                !!settings.userPoolClientId &&
                !!settings.userPoolId &&
                !!settings.region,
            );
            window.location.reload();
          } else {
            setHasConfiguredSettings(false);
          }
        });
    },
  };
};

export default useSettings;
