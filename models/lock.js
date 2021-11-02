// import EventEmitter from 'events'
// import createRequest from './glue-api.js'
const EventEmitter = require('events')
const createRequest = require('./glue-api')
const dayjs = require('dayjs')
const LOCK = require('../constants/lock.constants')

const DEFAULT_POLL_INTERVAL = 5 * 1000 // 5 seconds
const MIN_POLL_INTERVAL = 5 * 1000 // 5 seconds

// const DEFAULT_INFORM_INTERVAL = 1000 * 60 * 10 // 10 minutes

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

    #settings = {
        pollInterval: DEFAULT_POLL_INTERVAL
    }

    constructor({ lockId, apiKey, pollInterval = DEFAULT_POLL_INTERVAL }) {
        super()
        this.#apiKey = apiKey
        this.#lockId = lockId

        this.#requestHandler = createRequest({ apiKey: this.#apiKey })

        this.setPollInterval(pollInterval)

        this.#pollEvent(true)
        this.#getLockData()
    }

    setPollInterval(interval) {
        this.#settings.pollInterval = interval < MIN_POLL_INTERVAL ? MIN_POLL_INTERVAL : interval

        return this
    }

    /**
     * @description Perform lock/unlock actions
     * @param {string} action - 'lock' or 'unlock'
     */
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

    /**
     * @description Lock
     */
    async lock() {
        return this.#callOperation(LOCK.ACTION.LOCK)
    }

    /**
     * @description Unlock
     */
    async unlock() {
        return this.#callOperation(LOCK.ACTION.UNLOCK)
    }

    /**
     * @description Get current lock data and update object
     * @returns {Object} Raw lock data
     */
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

    /**
     * @description Converts events to status
     * @param {string} event - Lock event
     * @returns {string} Lock status
     */
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

    /**
     * @description Get lock status
     */
    get status() {
        return this.#status
    }

    /**
     * @description Get lock object data
     */
    get data() {
        return {
            status: this.#status,
            updated: this.#updated,
            state: this.#state,
            event: this.#event,
            data: this.#data
        }
    }

    /**
     * @description Follow up on operation (lock/unlock) until complete, error or timeout
     * @param {object} object
     * @param {string} object.operationId - Operation id
     * @param {string} object.action - Requested action
     */
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

    /**
     * @description Enable/disable polling of lock status
     * @param {boolean} enable - Enable/disable polling
     */
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
            if (this.#poll) {
                setTimeout(poll, this.#settings.pollInterval)
            }
        }

        // if previously disabled and want to start...then start
        if (enable && !this.#poll) {
            setTimeout(poll, this.#settings.pollInterval)
        }

        this.#poll = enable
    }
}

module.exports = GlueLock
