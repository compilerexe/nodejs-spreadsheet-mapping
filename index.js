let fs = require('fs')
let readline = require('readline')
let google = require('googleapis')
let googleAuth = require('google-auth-library')
let SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
let TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE) + '/.credentials/'
let TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json'
let sheets = google.sheets('v4')
let moment = require('moment-timezone').tz('Asia/Bangkok')

/* ===== MQTT ===== */
let mqtt = require('mqtt')
let client  = mqtt.connect('mqtt://mqtt.cmmc.io')

client.on('connect', function () {
  console.log('MQTT Connected')
  client.subscribe('WORK/TRAFFY/#')
})

client.on('message', function (topic, message) {

  /* ===== Setup ===== */
  let credential = 'client_secret.json'
  let spreadsheetId = '1QCc6DqNEM4xy8r12Vv1-Hm4ia6d8ahJoBBApr4zeusY'

  fs.readFile(credential, function processClientSecrets (err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err)
      return
    }
    //authorize(JSON.parse(content), listMajors)

    // setInterval(() => {
    authorize(JSON.parse(content), listMajors)
    // }, 1000)

  })

  function authorize (credentials, callback) {
    let clientSecret = credentials.web.client_secret
    let clientId = credentials.web.client_id
    let redirectUrl = credentials.web.redirect_uris[0]
    let auth = new googleAuth()
    let oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl)

    fs.readFile(TOKEN_PATH, function (err, token) {
      if (err) {
        getNewToken(oauth2Client, callback)
      } else {
        oauth2Client.credentials = JSON.parse(token)
        callback(oauth2Client)
      }
    })
  }

  function getNewToken (oauth2Client, callback) {
    let authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    })
    console.log('Authorize this app by visiting this url: ', authUrl)
    let rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    rl.question('Enter the code from that page here: ', function (code) {
      rl.close()
      oauth2Client.getToken(code, function (err, token) {
        if (err) {
          console.log('Error while trying to retrieve access token', err)
          return
        }
        oauth2Client.credentials = token
        storeToken(token)
        callback(oauth2Client)
      })
    })
  }

  function storeToken (token) {
    try {
      fs.mkdirSync(TOKEN_DIR)
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err
      }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token))
    console.log('Token stored to ' + TOKEN_PATH)
  }

  function listMajors (auth) {

    sheets.spreadsheets.values.get({
      auth: auth,
      spreadsheetId: spreadsheetId,
      range: 'SpreadSheetMapping!1:100'
    }, function (err, response) {

      if (err) {
        console.log('The API returned an error: ' + err)
        return
      }

      let machineObj = [] // fetch data google spreadsheet

      let rows = response.values
      if (rows.length === 0) {
        console.log('No data found.')
      } else {
        for (let i = 1; i < rows.length; i++) {
          let row = rows[i]
          machineObj.push({machineId: row[0], name: row[1]})
        }
      }

      console.log(`===== Read Data =====`)
      console.log(machineObj)


      let msg = JSON.parse(message.toString())
      console.log(msg)

      if (machineObj.find(x => x.machineId === msg.machineId) === undefined) {
        console.log(`===== Buffer Data =====`)
        console.log(machineObj)
        machineObj.push({machineId: msg.machineId, name: 'your_device_name', createdAt: moment.format()})
        writeData(machineObj, auth)
      }
    })
  }

  function writeData (obj, auth) {

    let store = []
    obj.forEach((v, idx) => {
      store.push([v.machineId, v.name, v.createdAt])
    })

    console.log(`===== Write Data =====`)
    console.log(store)

    let values = [
      [], // Cells
      ...store // Rows
    ];

    let data = [];
    data.push({
      range: 'SpreadSheetMapping!1:100',
      values: values
    });
// Additional ranges to update.

    let body = {
      data: data,
      valueInputOption: 'RAW'
    };

    sheets.spreadsheets.values.batchUpdate({
      auth: auth,
      spreadsheetId: spreadsheetId,
      resource: body
    }, function(err, result) {
      if(err) {
        // Handle error
        console.log(err);
      } else {
        console.log('%d cells updated.', result.totalUpdatedCells);
      }
    });
  }

  //console.log(message.toString())
})