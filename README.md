# CONTROL tablet

謎解き公演用の1920×1200タブレット画面です。HTML/CSS/JavaScriptのみで動作し、
STEP同期にはCloud Firestore、接続状態とプレイヤー端末のpresenceにはRealtime
Databaseを使います。

## 画面

- ホーム: チーム1〜10、前半・後半スタッフ、マスター、巨人スタッフ画面を選択
- プレイヤー: `1-1.jpg`を背景に表示し、上部8ボタンとFirestore同期のSTEP番号を重ねる
- 前半スタッフ: チーム1〜5の操作行を表示
- 後半スタッフ: チーム6〜10の操作行を表示
- スタッフ画面下部: その端末だけで正解音声（clear.mp3／音量0.8）と鈴音声（suzu.mp3／音量0.7）を再生
- マスター: 10チームの接続・STEP状況を表示し、ゲーム開始・終了を全端末へ送信
- 巨人スタッフ: 各チームの机上作業依頼を表示し、OK操作でスタッフ画面へ完了を返す
- スタッフ・マスター: 各チームの現在STEPに対応する補足情報を表示
- スタッフでSTEPを進めると巨人スタッフへ机上作業を依頼し、OK後はスタッフに完了表示
- ゲーム終了時: 全プレイヤー画面に`hutae.png`を表示
- プレイヤー: 右上の透明領域を5回連続タップするとスタッフメニューを表示
- プレイヤー: スタッフメニューの「STEP移動」から、通信停止中でも端末単体でSTEPを変更

直接開くURL:

- 前半スタッフ: `/?mode=staff&group=first`
- 後半スタッフ: `/?mode=staff&group=second`
- マスター: `/?mode=master`
- 巨人スタッフ: `/?mode=giant`
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
  visitedStep32: true | false
  deskTaskStatus: idle | pending | done
  deskTaskStep: 1
  deskTaskInstruction: 机の上に○○を置く
  deskTaskRevision: 1
  deskTaskRequestedAt: server timestamp
  deskTaskRequestedBy: client id
  deskTaskCompletedAt: server timestamp
  deskTaskCompletedBy: client id
  updatedAt: server timestamp
  updatedBy: client id
```

スタッフ画面でSTEP 3-1にいる際は、「3-2に進む」と「4-1に進む」を選択します。
4-1へ直接進む場合は確認画面を表示し、プレイヤー画面の3-2ログだけを非表示にします。
それ以外のSTEP表示や機能は通常どおり進みます。`visitedStep32`が存在しない既存データは、
3-2以降なら通常ルートとして扱います。

## 巨人スタッフの対象STEP設定

`app.js`上部の`DESK_TASKS`へ、対象STEPと作業内容を追加します。
未設定のSTEPでは机上作業依頼は発行されません。現在は空のため、全STEPが未設定です。

```js
const DESK_TASKS = Object.freeze({
  "2-1": "机の上にフラミンゴを置く",
  "4-1": "机の上の封筒を交換する",
});
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

## 素材キャッシュとバージョン更新

ホーム起動時に`asset-cache-config.js`の素材一覧をすべて取得し、画像はデコードまで行います。
取得済み素材はService WorkerのCache Storageへ保存され、次回以降も再利用されます。

画像・音声・CSS・JavaScriptなどを更新した時は、`asset-cache-config.js`先頭の
`version`を新しい値へ変更してください。

```js
version: "2026.06.23.4",
```

バージョンが変わると新しいキャッシュへ全素材を再取得し、読込完了後に古いキャッシュを
削除します。素材ファイルを追加した場合は、同ファイルの`mediaAssets`にもパスを追加します。
