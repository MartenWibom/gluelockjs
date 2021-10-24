// import EventEmitter from 'events'
// import createRequest from './glue-api.js'
const EventEmitter = require('events')
const createRequest = require('./glue-api')
const dayjs = require('dayjs')
const LOCK = require('../constants/lock.constants')

const POLL_INTERVAL = 5 * 1000 // 5 seconds

// export default
class GlueLock extends EventEmitter {
    #requestHandler

    #lockId
    #apiKey
    #data = {
        status: LOCK.STATUS.UNKNOWN,
        battery: 0,
        serial: '',
        firmware: '',
        connection: '',
        description: ''
    }

    #status = LOCK.STATUS.UNKNOWN
    #state
    #poll = false
    #updated
    #event
    #followUpTime = 2 * 60 // 2 minutes
    #poller

    constructor({ lockId, apiKey }) {
        super()
        this.#apiKey = apiKey
        this.#lockId = lockId

        this.#requestHandler = createRequest({ apiKey: this.#apiKey })

        this.#pollEvent(true)
        this.#getLockData()
    }

    async #callOperation(action) {
        this.#pollEvent(false)
        const response = await this.#requestHandler.post(`v1/locks/${this.#lockId}/operations`, {
            json: {
                type: action
            }
        })
        this.#state = response.status
        await this.#followUpOperation({ operationId: response.id, action })
        this.#pollEvent(true)
    }

    async lock() {
        return this.#callOperation(LOCK.ACTION.LOCK)
    }

    async unlock() {
        return this.#callOperation(LOCK.ACTION.UNLOCK)
    }

    async #getLockData() {
        const response = await this.#requestHandler.get(`v1/locks/${this.#lockId}`)
        this.#data = {
            battery: response.batteryStatus,
            serialNumber: response.serialNumber,
            firmwareVersion: response.firmwareVersion,
            connectionStatus: response.connectionStatus,
            description: response.description
        }

        return response
    }

    #convertEventToStatus(event) {
        switch (event) {
            case 'pressAndGo':
            case 'localLock':
            case 'manualLock':
            case 'remoteLock':
                return LOCK.STATUS.LOCKED
            case 'localUnlock':
            case 'manualUnlock':
            case 'remoteUnlock':
                return LOCK.STATUS.UNLOCKED
            case 'unknown':
            default:
                return LOCK.STATUS.UNKNOWN
        }
    }

    get status() {
        return this.#status
    }

    get data() {
        return {
            status: this.#status,
            updated: this.#updated,
            state: this.#state,
            event: this.#event,
            data: this.#data
        }
    }

    async #followUpOperation({ operationId, action }) {
        const check = async () => {
            const response = await this.#requestHandler.get(`v1/locks/${this.#lockId}/operations/${operationId}`)
            return response.status
        }

        const maxStopTime = dayjs().add(this.#followUpTime, 'seconds')
        let done = false // no FP here :(
        while (dayjs().isBefore(maxStopTime) && !done) {
            this.#state = await check()

            done = this.#state !== LOCK.OPERATION_STATUS.PENDING
            if (this.#state === LOCK.OPERATION_STATUS.COMPLETED) {
                this.#status = action === LOCK.ACTION.LOCK ? LOCK.STATUS.LOCKED : LOCK.STATUS.UNLOCKED
                this.#updated = dayjs().format()

                this.emit(this.#status, this.data)
            }
        }
    }

    #pollEvent(enable) {
        const poll = async () => {
            const result = await this.#getLockData()
            const returnedStatus = this.#convertEventToStatus(result.lastLockEvent.eventType)
            this.#event = result.lastLockEvent.eventType
            this.#updated = dayjs(result.lastLockEvent.eventTime).format()
            if (returnedStatus !== this.#status) {
                this.#status = returnedStatus
                // Detected status change
                this.emit(this.#status, this.data)
            }
        }

        if (enable && !this.#poller) {
            // Enable polling
            this.#poller = setInterval(() => poll(), POLL_INTERVAL)
        } else if (!enable && this.#poller) {
            // Temporarily disabling poller
            if (this.#poller)
                try {
                    clearInterval(this.#poller)
                    this.#poller.unref()
                    this.#poller = undefined
                } catch (err) {
                    // console.error('Poll error', err)
                    // log error
                }
        }
    }
}

module.exports = GlueLock
