# Google Workspace と SAML 連携

Google Workspace と SAML 連携を行う参考手順を紹介します。詳細なパラメーターは各環境に合わせて変更してください。

# 事前作業

GenU の初回デプロイを行います。初回デプロイを行ったあと、Cognito と Google Workspace の SAML 連携を行います。

CloudFormation の Stack の画面で Outputs タブを開き、WebUrl をメモします。

![image-20240205185011526](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240205185011526.png)

次に、Resource タブから、Cognito user pool の Physical ID をメモします。

![image-20240128114108630](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317105731051.png)

# Cognito の設定 : Domain 設定

Cognito domain の設定を進めます。
Cognito user pool の画面で、App integration タブを開き、Domain に関する画面を表示します。Cognito Domain が空白なので、Actions から Create Cognito domain を選択します。

![image-20240128115029927](../assets/SAML_WITH_ENTRA_ID/image-20240128115029927.png)

適当に任意の名前を付け、Create Cognito domain を押します。この手順では、`your-preferred-name-google` とします。世界で一意の名前を付ける必要があります。

![image-20240128115448597](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316234530866.png)

Cognito domain が設定されました。

![image-20240128115539920](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316234607065-1710645672447-1710645678992.png)

# Google Workspace の設定 : SAML アプリケーション

以下の URL から Google Workspace の管理画面を開き、SAML の設定を進めていきます。
https://admin.google.com/u/0/ac/home

アプリケーションの設定画面から、カスタム SAML アプリの追加を押します。

![image-20240316233910260](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316233910260.png)

Google Workspace の管理上の名前を入れます。任意の名前で大丈夫です。今回は `generative-ai-use-cases` と入れます。

![image-20240316234731919](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316234731919.png)

メタデータをダウンロードボタンを押して、`GoogleIDPMetadata.xml` をダウンロードしたあと、続行ボタンを押します。

![image-20240316234937484](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316234937484.png)

以下のパラメーターを指定します。「事前設定」で確認した User Pool の ID や、「Cognito の設定 : Domain 設定」で設定したドメイン名を指定します。

ACS の URL

```
# フォーマット
https://<入力した値>.auth.yourRegion.amazoncognito.com/saml2/idpresponse

# 入力例
https://your-preferred-name-google.auth.ap-northeast-1.amazoncognito.com/saml2/idpresponse
```

エンティティ ID

```
# フォーマット
urn:amazon:cognito:sp:<UserPoolID>

# 入力例
urn:amazon:cognito:sp:ap-northeast-1_Rxt6J1TtI
```

以下が入力した例です。入力したあと、続行ボタンを押します。

![image-20240316235220492](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316235220492.png)

属性で、Google Directory 上の属性を、どのように Cognito 側と連携するか設定します。`Primary email` に `email` と指定します。その後、完了ボタンを押します。

![image-20240316235522443](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316235522443.png)

アプリケーションが設定されました。

![image-20240316235732511](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240316235732511.png)

# Google Workspace : アクセス許可設定

作成したアプリケーションの詳細画面を開いて、アクセス許可の設定を行います。詳細画面から「オフ (すべてのユーザー)」の箇所をクリックします。

![image-20240317000224510](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317000224510.png)

このサンプル手順では、「会社全体」という組織に所属するユーザーに対してアクセス許可を行います。会社全体に対して「オン」を選択し、オーバーライドを押します。  
このアクセス許可の設定は、各環境に合わせて細かく設定することが出来るので、組織内のポリシーに基づいて変更してください。

![image-20240317000758589](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317000758589.png)

オンに変わりました。

![image-20240317000846899](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317000846899.png)

# Cognito の設定 : Federation

AWS マネジメントコンソールで Cognito の設定作業に戻ります。
Cognito User Pool の画面を開き、Sign-in experience タブから、Add identity provider を選択します。

![image-20240128124451746](../assets/SAML_WITH_ENTRA_ID/image-20240128124451746.png)

Google Workspace の連携で SAML を利用するため、SAML を選択します。**Google は選択せずに、SAML を選択します。**

![image-20240128124529523](../assets/SAML_WITH_ENTRA_ID/image-20240128124529523.png)

Provider name に任意の識別しやすい名前を入れます。ここで指定した Provider name を、後の手順で cdk.json に記載します。
Choose file を選び、Google Workspace からダウンロードしてきた「GoogleIDPMetadata.xml」をアップロードします。

![image-20240317001734180](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317001734180.png)

User pool attribute の email を指定します。
SAML attribute に、`email` 入力して、Add identity provider を選択します。

![image-20240317001748561](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317001748561.png)

設定が追加されました。

![image-20240317001814305](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317001814305.png)

# Cognito の設定 : Hosted UI

Google Workspace との連携を Hosted UI で利用するための設定をしていきます。App Integration タブを選択します。

![image-20240128125211108](../assets/SAML_WITH_ENTRA_ID/image-20240128125211108.png)

既存の App Client を指定します。

![image-20240128125243769](../assets/SAML_WITH_ENTRA_ID/image-20240128125243769.png)

Edit を押します。

![image-20240128125314475](../assets/SAML_WITH_ENTRA_ID/image-20240128125314475.png)

[事前作業](#事前作業)で確認した WebUrl の値を Allowed callback URLs と Allowed sign-out URLs に入力します。
[ローカル開発環境](./DEVELOPMENT.md) を利用してフロントエンドの開発を行いたい場合は、`http://localhost:5173` も Allowed callback URLs と Allowed sign-out URLs に追加で入力します。

![image-20240205185602299](../assets/SAML_WITH_ENTRA_ID/image-20240205185602299.png)

Identity Provider で `GoogleWorkspace` を選択します。また、Cognito user pool を利用した認証は停止したいため、Cognito user pool のチェックボックスを外します。

![image-20240317002017655](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317002017655.png)

Save changes を押します。

![image-20240128132707060](../assets/SAML_WITH_ENTRA_ID/image-20240128132707060.png)

追加されました。

![image-20240317125402303](../assets/SAML_WITH_GOOGLE_WORKSPACE/image-20240317125402303.png)

# cdk.json の編集

これで設定が完了したため、cdk.json の値を変更します。

- samlAuthEnabled : `true` を指定します。SAML 専用の認証画面に切り替わり、Cognito user pools を利用した従来の認証機能は利用できなくなります。
- samlCognitoDomainName : 「Cognito の設定 : Domain設定」で指定した Cognito Domain 名を入力します。
- samlCognitoFederatedIdentityProviderName : 「Cognito の設定 : Federation」で設定した Identity Provider の名前を入力します。

```json
  "context": {
　　 <省略>
    "samlAuthEnabled": true,
    "samlCognitoDomainName": "your-preferred-name-google.auth.ap-northeast-1.amazoncognito.com",
    "samlCognitoFederatedIdentityProviderName": "GoogleWorkspace",
```

設定後、再度デプロイを行うと SAML 連携が有効化されます。
