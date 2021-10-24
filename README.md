Interface for controlling and getting updates from lock "GlueLock".

# Requirement
- Gluelock with WiFi module
- Key owner's mail address and password (for getting API key)

# Get started
## Install module
```bash
npm install ha-gluelock
```

## Get API key
```shell
curl --request POST 'https://user-api.gluehome.com/v1/api-keys' \
--header 'Content-Type: application/json' \
-u your_email@example.com:your_password \
--data-raw '{
    "name": "Glue Key",
    "scopes": ["events.read", "locks.read", "locks.write"]
}'
```

# API
## Methods
- GlueLockManager.init()
- GlueLock.lock()
- GlueLock.unlock()

## Attributes
- GlueLockManager.locks
- GlueLock.data
- GlueLock.status

## Events
- locked
- unlocked

Event data payload
```javascript
{
    data: {
        battery: 87, 
        serialNumber: 'GLXXA.ALXXXX.XXXX', 
        firmwareVersion: '1.30', 
        connectionStatus: 'connected', 
        description: 'Door X'
    },
    event: 'localUnlock',
    state: 'completed',
    status: 'unlocked',
    updated: '2021-10-24T22:24:21+02:00'
}
```

# Example usage
```javascript
const { GlueLockManager } = require('gluelock')

const apiKey = '<api key from curl/http request above>'
const lockManager = new GlueLockManager({ apiKey })

    ;
(async () => {
    const locks = await lockManager.init()

    const lock = locks[0]

    lock.on('locked', (evt) => {
        console.log(evt)
    })

    lock.on('unlocked', (evt) => {
        console.log(evt)
    })

    setTimeout(async () => {
        console.log('Lock yourself in!')
        await lock.lock()
    }, 1000)
})()
```
