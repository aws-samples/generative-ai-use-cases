# ブラウザ拡張機能のインストール手順

ブラウザ拡張機能は、ご利用のブラウザにインストールすることで利用可能になります。ここでは、ブラウザへのインストール手順を解説します。

## インストール対象

- ご自身でビルドした場合
  - ビルド成果物である `browser-extension/dist/` フォルダ配下すべてが、インストール対象となります。
- 配布された zip ファイル等の圧縮ファイルを利用する場合
  - 圧縮ファイルを展開して、任意の場所に保存してください。
  - 展開したフォルダ配下すべてが、インストール対象となります。

## インストール方法

### Google Chrome の場合

画面右上のブラウザメニューを開いて、「拡張機能を管理」の画面を開いてください。
![Chromeメニュー](../assets/images/extension/chrome_menu.png)
![Chrome拡張機能メニュー](../assets/images/extension/chrome_extension_menu.png)

「拡張機能」の管理画面を開いたら、「デベロッパーモード」を `ON` にしてください。
![Chrome開発者モード](../assets/images/extension/chrome_dev_mode.png)

「デベロッパーモード」を `ON` にすると、「パッケージ化されていない拡張機能を読み込む」というボタンが表示されるので、それを押してください。
![Chromeインストール](../assets/images/extension/chrome_install.png)

フォルダ選択のウインドウが表示されるので、本手順書で示した「インストール対象」のフォルダを選択してください。
![ファイル選択](../assets/images/extension/file_choose.png)

インストールされると、拡張機能一覧に表示されます。
![Chromeインストール完了](../assets/images/extension/chrome_installed.png)

### Microsoft Edge の場合

画面上部の拡張機能ボタンでメニューを開き、「拡張機能を管理」の画面を開いてください。
![Edgeメニュー](../assets/images/extension/edge_menu.png)

「拡張機能」の管理画面を開いたら、「開発者モード」を `ON` にしてください。
![Edge開発者モード](../assets/images/extension/edge_dev_mode.png)

「開発者モード」を `ON` にすると、「展開して読み込む」というボタンが表示されるので、それを押してください。
![Edgeインストール](../assets/images/extension/edge_install.png)

フォルダ選択のウインドウが表示されるので、本手順書で示した「インストール対象」のフォルダを選択してください。
![ファイル選択](../assets/images/extension/file_choose.png)

インストールされると、拡張機能一覧に表示されます。
![Edgeインストール完了](../assets/images/extension/edge_installed.png)

## 利用方法

インストールが正常にできている場合、任意の Web サイトで文字を選択すると、以下のように「GenU 拡張機能」というポップアップ表示がされます。こちらをクリックすることで、選択した文字列が自動コピーされて拡張機能が起動します。
![ポップアップ表示](../assets/images/extension/extension_popup.png)

Web サイトの構造によっては、ポップアップが表示されないことがあります。その場合は、右クリックをしてメニューを表示し「GenU 拡張機能」をクリックして起動をしてください。この操作でも、選択した文字列が自動コピーされます。
![コンテキストメニュー](../assets/images/extension/extension_context_menu.png)

文字列を選択せずに右クリックした場合は、「GenU拡張機能を開く」というメニューが表示されます。この場合は、文字列はコピーされずに拡張機能が開きます。
![コンテキストメニュー](../assets/images/extension/extension_context_menu_default.png)

初回起動時はログイン画面が表示されます。GenU の Web アプリと共通の認証を利用しているので、そちらと同じログイン情報を使ってログインしてください。
![ログイン画面](../assets/images/extension/extension_login.png)

## アンインストール方法

### Google Chrome の場合

インストール方法を同じ手順で「拡張機能」の管理画面を開いてください。アンインストールしたい拡張機能の「削除」ボタンを押してください。

![Chromeアンインストール](../assets/images/extension/chrome_delete.png)

### Microsoft Edge の場合

インストール方法を同じ手順で「拡張機能」の管理画面を開いてください。アンインストールしたい拡張機能の「削除」ボタンを押してください。
![Edgeアンインストール](../assets/images/extension/edge_delete.png)
