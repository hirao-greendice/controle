# CONTROL tablet

謎解き公演用の1920×1200タブレット画面です。HTML/CSS/JavaScriptのみで動作し、
STEP同期にはCloud Firestore、接続状態とプレイヤー端末のpresenceにはRealtime
Databaseを使います。

## 画面

- ホーム: チーム1〜10、スタッフ画面、マスター画面を選択
- プレイヤー: `1-1.jpg`を背景に表示し、上部8ボタンとFirestore同期のSTEP番号を重ねる
- スタッフ: チーム1〜10の操作行を常時表示し、未接続の行には「接続無し」と表示
- マスター: 10チームの接続・STEP状況を表示し、ゲーム開始・終了を全端末へ送信
- ゲーム終了時: 全プレイヤー画面に`hutae.webp`を表示
- プレイヤー: 右上の透明領域を5回連続タップするとスタッフメニューを表示

直接開くURL:

- スタッフ: `/?mode=staff`
- マスター: `/?mode=master`
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
  online: true
  mode: player
  team: 1
  connectedAt: server timestamp
  lastSeenAt: server timestamp

control/presence/staff/{clientId}
control/presence/master/{clientId}

control/game
  status: running | ended
  updatedAt: server timestamp
  updatedBy: client id
```

プレイヤー端末は5秒ごとにpresenceを更新します。スタッフ端末を後から起動した場合も
現在のpresenceを購読し、チーム番号へ反映します。画面復帰・ネットワーク復帰時には
即時更新し、登録や更新に一時的に失敗した場合は自動で再登録します。
スタッフ端末では最終更新から20秒を超えた接続をオフラインとして再判定します。

プレイヤー端末が切断されると、RTDBの`onDisconnect`でpresenceが自動削除されます。
