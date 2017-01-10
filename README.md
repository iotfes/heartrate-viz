# heartrate-viz

## 目次

- このソースコードを使ってできること
- 基本構成
- 準備手順
  - `httpie` を導入する
  - c8y REST APIの正常性確認
  - c8y デバイスの作成
  - データの送信
  - デバイス管理へのアクセスし、アップロードデータを確認
- Raspberry Pi3セットアップとプログラムの導入
  - RPi3をセットアップする
  - スクリプトを実行する
  - デバイス管理へのアクセスし、アップロードデータを確認
- Author


# このソースコードを使ってできること

- ウェアラブルデバイスから心拍数、心拍変動などの情報をリアルタイムで取得し、Raspberry Pi3やPC経由で、c8yサーバへデータを送信できる
- c8y上で、上記「ひと」の状態を用いたIoTアプリケーションの作成できる
- c8y上で、他のセンサから取得した「もの」の状態と組み合わせた、より高度なアプリケーションを作成できる


# 基本構成

下記のデバイス、サーバ、クライアントから構成される

```
BLE device --(BLE)-> Gateway --(http(s))-> c8y server　<-(http(s))-- Client
```

- **BLE device:** heart rateサービスに対応したBLEデバイス。身につけることで、定期的に心拍データを生成し、BLE経由でゲートウェイへ渡す
- **Gateway:** node.jsが動作するRaspberry Pi3またはPC。BLE経由で受け取ったデータを整形し、c8y REST API経由でサーバへ渡す
- **c8y server:** c8y REST API経由で心拍データを受信し、蓄積する。また、ClientからのWebアクセスを受付け、ダッシュボードなどを表示
- **Client:** クライアントPCから、ブラウザでc8yサーバへアクセスし、データをリアルタイムで可視化する
    

# 準備手順

##  `httpie` を導入する

このチュートリアルでは、c8yのREST APIをコマンドラインから叩く際、下記を用いる。
> [jkbrzt/httpie: Modern command line HTTP client – user-friendly curl alternative with intuitive UI, JSON support, syntax highlighting, wget-like downloads, extensions, etc. Follow https://twitter.com/clihttp for tips and updates.](https://github.com/jkbrzt/httpie)

Cumulocity User Guideを参考に、REST APIの正常性確認、デバイスを作成を順に行う。
> [Cumulocity | Introduction to REST](https://cumulocity.com/guides/rest/introduction/)


## c8y REST APIの正常性確認
### Request Example

```
$ http -a {テナント名}/{ユーザ名}:{パスワード} -v GET http://xxx.cumulocity.com/platform
```

### Response Example
```
GET /platform HTTP/1.1
Accept: */*
Accept-Encoding: gzip, deflate
Authorization: Basic xxx
Connection: keep-alive
Host: xxx.cumulocity.com
User-Agent: HTTPie/0.9.3



HTTP/1.1 200 OK
Connection: keep-alive
Content-Type: application/vnd.com.nsn.cumulocity.platformApi+json; charset=UTF-8; ver=0.9
Date: Sun, 20 Nov 2016 10:39:23 GMT
Server: nginx
Strict-Transport-Security: max-age=31536000; includeSubDomains
Transfer-Encoding: chunked

{
    "alarm": {
~~~~~~~~~~~
省略
~~~~~~~~~~~
    }
}
```

## c8y デバイスの作成

適当なデバイス名を決めて作成する。(ここでは`hrviz-001`)

### Request Example

```
$ http -a {テナント名}/{ユーザ名}:{パスワード} -v POST http://xxx.cumulocity.com/inventory/managedObjects name=hrviz-001
```

### Response Example

```
POST /inventory/managedObjects HTTP/1.1
Accept: application/json
Accept-Encoding: gzip, deflate
Authorization: Basic xxx
Connection: keep-alive
Content-Length: 26
Content-Type: application/json
Host: xxx.cumulocity.com
User-Agent: HTTPie/0.9.3

{
    "name": "{先ほど指定した名称}"
}

HTTP/1.1 201 Created
Connection: keep-alive
Content-Type: application/vnd.com.nsn.cumulocity.managedObject+json; charset=UTF-8; ver=0.9
Date: Sun, 20 Nov 2016 10:46:09 GMT
Location: http://xxx.cumulocity.com/inventory/managedObjects/{払い出されたdevice id}
Server: nginx
Strict-Transport-Security: max-age=31536000; includeSubDomains
Transfer-Encoding: chunked

{
    "assetParents": {
        "references": [],
        "self": "http://xxx.cumulocity.com/inventory/managedObjects/{払い出されたdevice id}/assetParents"
    },
    "childAssets": {
        "references": [],
        "self": "http://xxx.cumulocity.com/inventory/managedObjects/{払い出されたdevice id}/childAssets"
    },
    "childDevices": {
        "references": [],
        "self": "http://xxx.cumulocity.com/inventory/managedObjects/{払い出されたdevice id}/childDevices"
    },
    "creationTime": "2016-11-20T11:46:09.867+01:00",
    "deviceParents": {
        "references": [],
        "self": "http://xxx.cumulocity.com/inventory/managedObjects/{払い出されたdevice id}/deviceParents"
    },
    "id": "{払い出されたdevice id}",
    "lastUpdated": "2016-11-20T11:46:09.867+01:00",
    "name": "hrviz-001",
    "owner": "xxx@xxx.xxx",
    "self": "http://xxx.cumulocity.com/inventory/managedObjects/{払い出されたdevice id}"
}
```

## データの送信

作成したデバイスに対して、テストデータポイントを送信する。簡単のため、あらかじめ `Sensor Library` で定義された下記の温度データポイント用フォーマットを使用する。(本来は `気温測定用` の定義だが、ここでは `心拍数用` に使う)

- フォーマット例

```
{
	"c8y_TemperatureMeasurement": {
		"T": {
				"value": "21.23",
				"unit":"C"
			 }
	},
	"time":"2016-11-20T21:35:00.123+09:00",
	"source": {
		"id":"{払い出されたdevice id}"
	},
	"type":"c8y_PTCMeasurement"
}
```

データをREST API経由でc8yサーバへ送信(POST)し、表示されるかを確認する。下記 `time` は直近の日付時刻に修正して送信する。

### Request Example

```
$ http -a {テナント名}/{ユーザ名}:{パスワード} -v POST http://xxx.cumulocity.com/measurement/measurements/ < '{"c8y_TemperatureMeasurement":{"T":{"value":"21.23","unit":"C"}},"time":"2016-11-20T21:35:00.123+09:00","source":{"id":"{払い出されたdevice id}"},"type":"c8y_PTCMeasurement"}'
```

### Response Example

```
*   Trying 52.28.26.32...
* Connected to xxx.cumulocity.com (52.28.26.32) port 80 (#0)
* Server auth using Basic with user 'xxx@xxx'
> POST /measurement/measurements/ HTTP/1.1
> Host: xxx.cumulocity.com
> Authorization: Basic xxx
> User-Agent: curl/7.43.0
> Accept: application/vnd.com.nsn.cumulocity.measurement+json; charset=UTF-8; ver=0.9
> Content-type: application/vnd.com.nsn.cumulocity.measurement+json; charset=UTF-8; ver=0.9
> Content-Length: 157
>
* upload completely sent off: 157 out of 157 bytes
< HTTP/1.1 201 Created
< Server: nginx
< Date: Sun, 20 Nov 2016 10:49:23 GMT
< Content-Type: application/vnd.com.nsn.cumulocity.measurement+json; charset=UTF-8; ver=0.9
< Transfer-Encoding: chunked
< Connection: keep-alive
< Location: http://xxx.cumulocity.com/measurement/measurements/{計測ポイント番号}
< Strict-Transport-Security: max-age=31536000; includeSubDomains
<
* Connection #0 to host xxx.cumulocity.com left intact
{"time":"2014-12-15T13:00:00.123+02:00","id":"{計測ポイント番号}","self":"http://xxx.cumulocity.com/measurement/measurements/{計測ポイント番号}","source":{"id":"{払い出されたdevice id}","self":"http://xxx.cumulocity.com/inventory/managedObjects/{払い出されたdevice id}"},"type":"c8y_PTCMeasurement","c8y_TemperatureMeasurement":{"T":{"unit":"C","value":21.23}}}
```

## デバイス管理へのアクセスし、アップロードデータを確認

下記URLをブラウザに入力し、デバイス管理画面へアクセスする。dashboardから、先ほどアップロードしたデータが表示されることを確認する。

```
https://xxx.cumulocity.com/apps/devicemanagement/index.html?#/device/{払い出されたdevice id}/info
```


# Raspberry Pi3セットアップとプログラムの導入
## RPi3をセットアップする

下記などを参考に、 `Node.js` のアップデート、および npmによる `noble` の導入を行う 

- [Raspbian Jessie with PIXELでnobleを使う - Qiita](http://qiita.com/mayfair/items/88dfd80f8b74c9ffce18)


### スクリプトをRPi3の適切なフォルダにコピーし、準備

- 本repositoryをcloneする、または `sftp` でファイルを転送する、などの方法でRPi3へスクリプトを配置する
- `config-sample.js` の必要情報を編集し、 `config.js` にリネームする

## スクリプトを実行する

- 身につけて、定期的に心拍データを生成し、BLE経由でサーバに渡す
- NTT docomo hitoe Transmitter, EPSON Pulsense, Polar H7 etc任意の心拍が計測でき、BLE Services/Characteristicsに対応したウェアラブルデバイスを準備する
- 下記コマンドを実行する

```
$ node heartrate-viz.js
```

## デバイス管理へのアクセスし、アップロードデータを確認

下記URLをブラウザに入力し、デバイス管理画面へアクセスする。dashboardから、先ほどアップロードしたデータが表示されることを確認する。

```
https://xxx.cumulocity.com/apps/devicemanagement/index.html?#/device/{払い出されたdevice id}/info
```


# Author

@tomo-makes / Tomo Masuda

