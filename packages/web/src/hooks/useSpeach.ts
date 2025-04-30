import { useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { Polly, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';
import { useTranslation } from 'react-i18next';

// Only neural Engine is available
// https://docs.aws.amazon.com/ja_jp/polly/latest/dg/available-voices.html
const LanguageVoiceMapping: Record<string, VoiceId> = {
  en: 'Joanna',
  ja: 'Kazuha',
  zh: 'Zhiyu',
  ko: 'Seoyeon',
  fr: 'Lea',
  es: 'Lucia',
  de: 'Vicki',
};

const useSpeach = (language: string) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [voiceId, setVoiceId] = useState<VoiceId>('Joanna');

  useEffect(() => {
    const tmpVoiceId = LanguageVoiceMapping[language];
    if (tmpVoiceId) {
      setVoiceId(tmpVoiceId);
    } else {
      console.error(`No voiceId found for language ${language}`);
    }
  }, [language]);

  return {
    loading,
    synthesizeSpeach: async (text: string): Promise<string> => {
      setLoading(true);

      const token = (await fetchAuthSession()).tokens?.idToken?.toString();

      if (!token) {
        setLoading(false);
        throw new Error(t('common.notAuthenticated'));
      }

      const region = import.meta.env.VITE_APP_REGION;
      const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID;
      const idPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID;
      const cognito = new CognitoIdentityClient({ region });
      const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

      const polly = new Polly({
        region,
        credentials: fromCognitoIdentityPool({
          client: cognito,
          identityPoolId: idPoolId,
          logins: {
            [providerName]: token,
          },
        }),
      });

      const command = new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: 'mp3',
        VoiceId: voiceId,
        Engine: 'neural',
      });

      const response = await polly.send(command);
      const audioStream = response.AudioStream!.transformToWebStream();

      const audioBlob = await new Response(audioStream).blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      setLoading(false);

      return audioUrl;
    },
  };
};

export default useSpeach;
