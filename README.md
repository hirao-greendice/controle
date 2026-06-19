# CONTROL tablet

謎解き公演用の1920×1200タブレット画面です。HTML/CSS/JavaScriptのみで動作し、
STEP同期にはCloud Firestore、接続状態とプレイヤー端末のpresenceにはRealtime
Databaseを使います。

## 画面

- ホーム: チーム1〜10、スタッフ画面を選択
- プレイヤー: 現在は確認用のチーム番号とSTEPのみ表示
- スタッフ: チーム1〜10を常時表示し、起動中のチームを明るい緑で表示
- プレイヤー: 右上の透明領域を5回連続タップするとスタッフメニューを表示

直接開くURL:

- スタッフ: `/?mode=staff`
- チーム3のプレイヤー: `/?mode=player&team=3`

## ローカル起動

ES Modulesを使うため、`index.html`を直接ダブルクリックせずHTTPサーバー経由で開きます。

```powershell
python -m http.server 8080
```

その後、`http://localhost:8080` を開いてください。別タブまたは別端末でプレイヤー画面と
スタッフ画面を開くと同期を確認できます。

## Firebase設定

Firebase Consoleで以下を有効にしてください。

1. Cloud Firestore Database
2. Realtime Database

ルールはこのリポジトリの `firestore.rules` と `database.rules.json` にあります。
Firebase CLIを使う場合:

```powershell
firebase use control-c7b48
firebase deploy --only firestore:rules,database,hosting
```

現在のルールは会場内で認証なしに使う最小構成です。インターネットへ一般公開する場合は、
Firebase AuthenticationやApp Checkを追加してアクセスを制限してください。

## データ構造

Firestore:

```text
teams/team-01
  teamNumber: 1
  step: 1
  updatedAt: server timestamp
  updatedBy: client id
```

Realtime Database:

```text
control/presence/players/team-01/{clientId}
control/presence/staff/{clientId}
```

プレイヤー端末が切断されると、RTDBの`onDisconnect`でpresenceが自動削除されます。
